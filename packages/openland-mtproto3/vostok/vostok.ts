import WebSocket = require('ws');
import { createIterator } from '../../openland-utils/asyncIterator';
import {
    encodeMessage,
    isGQLRequest,
    isGQLSubscription, isGQLSubscriptionStop,
    isInitialize, isMessage,
    makeGQLResponse, makeGQLSubscriptionComplete,
    makeGQLSubscriptionResponse,
    makeInitializeAck, makeMessage,
} from '../vostok-schema/VostokTypes';
import * as http from 'http';
import * as https from 'https';
import { execute, GraphQLSchema, parse } from 'graphql';
import { QueryCache } from '../queryCache';
import { Context, createNamedContext } from '@openland/context';
import { gqlSubscribe } from '../gqlSubscribe';
import { asyncRun, isAsyncIterator, makeMessageId } from '../utils';
import { cancelContext } from '@openland/lifetime';
import { createLogger } from '@openland/log';
import { VostokConnection } from './VostokConnection';
import { VostokSession } from './VostokSession';
import { VostokSessionsManager } from './VostokSessionsManager';

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
            let {message} = data;

            if (session.state !== 'active') {
                session.destroy();
            } else if (isGQLRequest(message.body)) {
                session.sendAck([message.id]);
                let ctx = await params.context(session.authParams, message.body);
                await params.onOperation(ctx, message.body);

                let result = await execute({
                    schema: params.executableSchema,
                    document: parse(message.body.query),
                    operationName: message.body.operationName,
                    variableValues: message.body.variables ? JSON.parse(message.body.variables) : undefined,
                    contextValue: ctx
                });
                session.send(makeGQLResponse({ id: message.body.id, result: await params.formatResponse(result) }));
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

async function authorizeConnection(serverParams: VostokServerParams, connection: VostokConnection, sessionsManager: VostokSessionsManager) {
    let state = 'init';
    for await (let message of connection.getIncomingMessagesIterator()) {
        if (!isMessage(message)) {
            continue;
        }

        if (state === 'init' && !isInitialize(message.body)) {
            connection.close();
            return null;
        } else if (state === 'init' && isInitialize(message.body)) {
            state = 'waiting_auth';
            let authParams = await serverParams.onAuth(message.body.authToken);
            state = 'connected';
            if (message.body.sessionId) {
                let target = sessionsManager.get(message.body.sessionId);
                if (target) {
                    log.log(rootCtx, 'switch to session #', target.sessionId);
                    target.addConnection(connection);
                    connection.sendRaw(encodeMessage(makeMessage({
                        id: makeMessageId(),
                        body: makeInitializeAck({ sessionId: target.sessionId }),
                        ackMessages: [message.id]
                    })));
                    return target;
                }
            }
            let session = sessionsManager.newSession();
            log.log(rootCtx, 'new session #', session.sessionId);
            session.addConnection(connection);
            session.authParams = authParams;
            session.send(makeInitializeAck({ sessionId: session.sessionId }), [message.id]);
            return session;
        }
    }
    return null;
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
    let sessionsManager = new VostokSessionsManager();

    asyncRun(async () => {
        for await (let connect of server.incomingConnections) {
            asyncRun(async () => {
                let session = await authorizeConnection(params, connect, sessionsManager);
                if (!session) {
                    return;
                }
                handleSession(session, params);
            });
        }
    });
    return server.socket;
}