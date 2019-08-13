import {
    execute,
    GraphQLSchema,
    parse,
} from 'graphql';
import WebSocket = require('ws');
import * as http from 'http';
import * as https from 'https';
import { isAsyncIterator, isSubscriptionQuery } from './utils';
import { delay } from '../openland-utils/timer';
import { gqlSubscribe } from './gqlSubscribe';
import { Context, createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { cancelContext } from '@openland/lifetime';

const logger = createLogger('apollo');

interface GQlServerOperation {
    operationName: string|null|undefined;
    variables: any;
    query: string;
}

interface FuckApolloServerParams {
    server?: http.Server | https.Server;
    path: string;
    executableSchema: GraphQLSchema;

    onAuth(payload: any, req: http.IncomingMessage): Promise<any>;

    context(params: any, operation: GQlServerOperation): Promise<Context>;

    subscriptionContext(params: any, operation: GQlServerOperation, firstCtx?: Context): Promise<Context>;

    formatResponse(response: any): Promise<any>;

    onOperation(ctx: Context, operation: GQlServerOperation): Promise<any>;
}

class FuckApolloSession {
    public state: 'INIT' | 'WAITING_CONNECT' | 'CONNECTED' = 'INIT';
    public authParams: any;
    public operations: { [operationId: string]: { destroy(): void } } = {};
    public waitAuth: Promise<any> = Promise.resolve();
    public socket: WebSocket;

    constructor(socket: WebSocket) {
        this.socket = socket;
    }

    setConnected = () => this.state = 'CONNECTED';

    setWaitingConnect = () => this.state = 'WAITING_CONNECT';

    send = (data: any) => this.socket.send(JSON.stringify(data));

    sendConnectionAck = () => this.send({ type: 'connection_ack' });

    sendKeepAlive = () => this.send({ type: 'ka' });

    sendData = (id: string, payload: any) => this.send({ id, type: 'data', payload });

    sendComplete = (id: string) => this.send({ id, type: 'complete', payload: null });

    addOperation = (id: string, destroy: () => void) => {
        this.stopOperation(id);
        this.operations[id] = { destroy };
    }

    stopOperation = (id: string) => {
        if (this.operations[id]) {
            this.operations[id].destroy();
            delete this.operations[id];
        }
    }

    stopAllOperations = () => {
        for (let operationId in this.operations) {
            this.operations[operationId].destroy();
            delete this.operations[operationId];
        }
    }
}

const asyncRun = (handler: () => Promise<any>) => {
    // tslint:disable-next-line:no-floating-promises
    handler();
};

async function handleMessage(params: FuckApolloServerParams, socket: WebSocket, req: http.IncomingMessage, session: FuckApolloSession, message: any) {
    if (session.state === 'INIT') {
        // handle auth here
        if (!message.type || message.type !== 'connection_init') {
            socket.close();
            return;
        }

        session.setWaitingConnect();
        session.waitAuth = (async () => {
            session.authParams = await params.onAuth(message.payload, req);
            session.sendConnectionAck();
            session.waitAuth = Promise.resolve();
            session.setConnected();
            asyncRun(async () => {
                while (session.socket.readyState === WebSocket.OPEN && session.state === 'CONNECTED') {
                    session.sendKeepAlive();
                    await delay(5000);
                }
            });
        })();
    } else if (session.state === 'CONNECTED' || session.state === 'WAITING_CONNECT') {
        await Promise.resolve(session.waitAuth);

        if (message.type && message.type === 'start') {
            let query = parse(message.payload.query);
            let isSubscription = isSubscriptionQuery(query, message.payload.operationName);

            if (isSubscription) {
                let working = true;
                let ctx = await params.subscriptionContext(session.authParams, message.payload);
                asyncRun(async () => {
                    await params.onOperation(ctx, message.payload);

                    let iterator = await gqlSubscribe({
                        schema: params.executableSchema,
                        document: query,
                        operationName: message.payload.operationName,
                        variableValues: message.payload.variables,
                        fetchContext: async () => await params.subscriptionContext(session.authParams, message.payload, ctx),
                        ctx
                    });

                    if (!isAsyncIterator(iterator)) {
                        // handle error
                        session.sendData(message.id, await params.formatResponse(iterator));
                        session.sendComplete(message.id);
                        session.stopOperation(message.id);
                        return;
                    }

                    for await (let event of iterator) {
                        if (!working) {
                            break;
                        }
                        session.sendData(message.id, await params.formatResponse(event));
                    }
                    session.sendComplete(message.id);
                });
                session.addOperation(message.id, () => {
                    working = false;
                    cancelContext(ctx);
                });
            } else {
                let ctx = await params.context(session.authParams, message.payload);
                await params.onOperation(ctx, message.payload);

                let result = await execute({
                    schema: params.executableSchema,
                    document: query,
                    operationName: message.payload.operationName,
                    variableValues: message.payload.variables,
                    contextValue: ctx
                });
                session.sendData(message.id, await params.formatResponse(result));
                session.sendComplete(message.id);
            }
        } else if (message.type && message.type === 'stop') {
            session.stopOperation(message.id);
        } else if (message.type && message.type === 'connection_terminate') {
            session.stopAllOperations();
            socket.close();
        }
    }
}

async function handleConnection(params: FuckApolloServerParams, socket: WebSocket, req: http.IncomingMessage) {
    let session = new FuckApolloSession(socket);

    socket.on('message', async data => {
        await handleMessage(params, socket, req, session, JSON.parse(data.toString()));
    });
    socket.on('close', (code, reason) => {
        logger.log(createNamedContext('apollo'), 'close connection', code, reason);
        session.stopAllOperations();
    });
    socket.on('error', (err) => {
        logger.log(createNamedContext('apollo'), 'connection error', err);
        session.stopAllOperations();
    });
}

export async function createFuckApolloWSServer(params: FuckApolloServerParams) {
    const ws = new WebSocket.Server(params.server ? { server: params.server, path: params.path } : { noServer: true });
    ws.on('connection', async (socket, req) => {
        await handleConnection(params, socket, req);
    });
    return ws;
}