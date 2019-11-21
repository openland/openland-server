import WebSocket = require('ws');
import { createIterator } from '../../openland-utils/asyncIterator';
import {
    isGQLRequest,
    isGQLSubscription, isGQLSubscriptionStop,
    isInitialize,
    makeGQLResponse, makeGQLSubscriptionComplete,
    makeGQLSubscriptionResponse,
    makeInitializeAck,
} from '../vostok-schema/VostokTypes';
import * as http from 'http';
import * as https from 'https';
import { execute, GraphQLSchema, parse } from 'graphql';
import { QueryCache } from '../queryCache';
import { Context, createNamedContext } from '@openland/context';
import { gqlSubscribe } from '../gqlSubscribe';
import { asyncRun, isAsyncIterator } from '../utils';
import { cancelContext } from '@openland/lifetime';
import { createLogger } from '@openland/log';
import { randomKey } from '../../openland-utils/random';
import { delay } from '../../openland-utils/timer';
import { VostokConnection } from './VostokConnection';
import { VostokSession } from './VostokSession';

const rootCtx = createNamedContext('vostok');
const log = createLogger('vostok');

interface Server {
    socket: WebSocket.Server;
    incomingConnections: AsyncIterable<VostokConnection>;
}

export const PING_TIMEOUT = 1000 * 30;
export const PING_CLOSE_TIMEOUT = 1000 * 60 * 5;
export const EMPTY_SESSION_TTL = 1000 * 5;

// const PING_TIMEOUT = 1000;
// const PING_CLOSE_TIMEOUT = 1000 * 5;

export function createWSServer(options: WebSocket.ServerOptions): Server {
    const ws = new WebSocket.Server(options);
    let iterator = createIterator<VostokConnection>(() => 0);

    ws.on('connection', async (socket, req) => {
        let connection = new VostokConnection();
        connection.setSocket(socket);
        iterator.push(connection);
    });

    return {
        socket: ws,
        incomingConnections: iterator
    };
}

function handleSession(session: VostokSession, params: VostokServerParams) {
    asyncRun(async () => {
        for await (let data of session.incomingMessages) {
            let {message, connection} = data;

            if (session.state === 'init' && !isInitialize(message.body)) {
                connection.close();
                session.destroy();
            } else if (session.state === 'init' && isInitialize(message.body)) {
                session.state = 'waiting_auth';
                session.authParams = await params.onAuth(message.body.authToken);
                session.state = 'connected';
                if (message.body.sessionId) {
                    if (session.switchToSession(message.id, message.body.sessionId)) {
                        return;
                    }
                }
                session.send(makeInitializeAck({ sessionId: session.sessionId }), [message.id]);
            } else if (session.state !== 'connected') {
                session.destroy();
            } else if (isGQLRequest(message.body)) {
                let ctx = await params.context(session.authParams, message.body);
                await params.onOperation(ctx, message.body);

                let result = await execute({
                    schema: params.executableSchema,
                    document: parse(message.body.query),
                    operationName: message.body.operationName,
                    variableValues: message.body.variables ? JSON.parse(message.body.variables) : undefined,
                    contextValue: ctx
                });

                session.send(makeGQLResponse({ id: message.body.id, result: await params.formatResponse(result) }), [message.id]);
            } else if (isGQLSubscription(message.body)) {
                session.sendAck([message.id]);
                let working = true;
                let ctx = await params.subscriptionContext(session.authParams, message.body);
                asyncRun(async () => {
                    if (!isGQLSubscription(message.body)) {
                        return;
                    }
                    await params.onOperation(ctx, message.body);

                    let iterator = await gqlSubscribe({
                        schema: params.executableSchema,
                        document: parse(message.body.query),
                        operationName: message.body.operationName,
                        variableValues: message.body.variables ? JSON.parse(message.body.variables) : undefined,
                        fetchContext: async () => await params.subscriptionContext(session.authParams, message.body as any, ctx),
                        ctx
                    });

                    if (!isAsyncIterator(iterator)) {
                        // handle error
                        session.send(makeGQLSubscriptionResponse({ id: message.body.id, result: JSON.stringify(await params.formatResponse(iterator)) }));
                        return;
                    }

                    for await (let event of iterator) {
                        if (!working) {
                            break;
                        }
                        session.send(makeGQLSubscriptionResponse({ id: message.body.id, result: await params.formatResponse(event) }));
                    }
                    session.send(makeGQLSubscriptionComplete({ id: message.body.id }));
                });
                session.operations.add(message.body.id, () => {
                    working = false;
                    cancelContext(ctx);
                });
            } else if (isGQLSubscriptionStop(message.body)) {
                session.operations.stop(message.body.id);
                session.sendAck([message.id]);
            }
        }
        session.destroy();
    });
}

interface GQlServerOperation {
    operationName: string|null|undefined;
    variables: any;
    query: string;
}

interface VostokServerParams {
    server?: http.Server | https.Server;
    path: string;
    executableSchema: GraphQLSchema;
    queryCache?: QueryCache;

    onAuth(token: string): Promise<any>;

    context(params: any, operation: GQlServerOperation): Promise<Context>;

    subscriptionContext(params: any, operation: GQlServerOperation, firstCtx?: Context): Promise<Context>;

    formatResponse(response: any): Promise<any>;

    onOperation(ctx: Context, operation: GQlServerOperation): Promise<any>;
}

export function initVostokServer(params: VostokServerParams) {
    let server = createWSServer(params.server ? { server: params.server, path: params.path } : { noServer: true });
    let sessions = new Map<string, VostokSession>();
    asyncRun(async () => {
        for await (let connect of server.incomingConnections) {
            let sessionId = randomKey();
            let session = new VostokSession(sessionId, sessions);
            session.addConnection(connect);
            sessions.set(sessionId, session);
            handleSession(session, params);
        }
    });
    asyncRun(async () => {
        while (true) {
            for (let session of sessions.values()) {
                if (session.noConnectsSince && Date.now() - session.noConnectsSince > EMPTY_SESSION_TTL) {
                    log.log(rootCtx, 'drop session', session.sessionId);
                    session.destroy();
                    sessions.delete(session.sessionId);
                }
            }
            await delay(1000);
        }
    });
    return server.socket;
}