import { SpaceXSession, SpaceXSessionDescriptor } from './../openland-spacex/SpaceXSession';
import { Concurrency } from './../openland-server/concurrency';
import {
    DocumentNode,
    GraphQLSchema,
    parse,
} from 'graphql';
import WebSocket = require('ws');
import * as http from 'http';
import * as https from 'https';
import { isAsyncIterator } from './utils';
import { delay } from '../openland-utils/timer';
import { gqlSubscribe } from './gqlSubscribe';
import { Context } from '@openland/context';
// import { createLogger } from '@openland/log';
import { cancelContext } from '@openland/lifetime';
import { QueryCache } from './queryCache';
import { randomKey } from '../openland-utils/random';
// import { createMetric } from '../openland-module-monitoring/Metric';
import { Shutdown } from '../openland-utils/Shutdown';
import { Metrics } from 'openland-module-monitoring/Metrics';
import uuid from 'uuid';
import { getOperationType } from 'openland-spacex/utils/getOperationType';

// const logger = createLogger('apollo');

interface GQlServerOperation {
    operationName: string | null | undefined;
    variables: any;
    query: string;
}

// For compatibility reasons
const fetchGQlServerOperation = (src: any) => ({
    operationName: src.operationName || src.name || undefined,
    variables: src.variables,
    query: src.query
});

interface FuckApolloServerParams {
    server?: http.Server | https.Server;
    path: string;
    executableSchema: GraphQLSchema;
    queryCache?: QueryCache;

    onAuth(payload: any, req: http.IncomingMessage): Promise<any>;

    context(params: any, operation: GQlServerOperation, req: http.IncomingMessage): Promise<Context>;

    subscriptionContext(params: any, operation: GQlServerOperation, firstCtx: Context | undefined, req: http.IncomingMessage): Promise<Context>;

    formatResponse(response: any, operation: GQlServerOperation, context: Context): any;

    onOperation(ctx: Context, operation: GQlServerOperation): Promise<any>;

    onOperationFinish(ctx: Context, operation: GQlServerOperation, duration: number): void;

    onEventResolveFinish(ctx: Context, operation: GQlServerOperation, duration: number): Promise<any>;
}

class FuckApolloSession {
    public id = randomKey();
    public state: 'INIT' | 'WAITING_CONNECT' | 'CONNECTED' = 'INIT';
    public authParams: any;
    public operations: { [operationId: string]: { destroy(): void } } = {};
    public waitAuth: Promise<any> = Promise.resolve();
    public socket: WebSocket | null;
    public session!: SpaceXSession;
    public protocolVersion = 1;
    public lastPingAck: number = Date.now();
    public lastRequestTime: number = Date.now();
    public pingCounter = 0;
    public pingAckCounter = 0;
    public executionPool = Concurrency.Execution.get(this.id);
    public operationBucket = Concurrency.Operation.get(this.id);

    constructor(socket: WebSocket) {
        this.socket = socket;
    }

    setConnected = () => this.state = 'CONNECTED';

    setWaitingConnect = () => this.state = 'WAITING_CONNECT';

    send = (data: any) => {
        if (this.socket) {
            Metrics.WebSocketPacketsOut.inc();
            this.socket.send(JSON.stringify(data));
        }
    }

    sendConnectionAck = () => this.send({ type: 'connection_ack' });

    sendKeepAlive = () => this.send({ type: 'ka' });

    sendPing = () => {
        this.send({ type: 'ping' });
        this.pingCounter++;
    }

    sendPingAck = () => this.send({ type: 'pong' });

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

    close = () => {
        this.stopAllOperations();
        this.socket!.close();
        this.socket!.removeAllListeners('message');
        this.socket!.removeAllListeners('close');
        this.socket!.removeAllListeners('error');
        this.socket = null;
        this.operations = {};
        if (this.session) {
            this.session.close();
        }
    }

    isConnected = () => this.socket && this.socket!.readyState === WebSocket.OPEN && this.state === 'CONNECTED';

    sendRateLimitError = (id: string) => this.sendData(id, {
        data: null,
        errors: [{
            message: 'An unexpected error occurred. Please, try again. If the problem persists, please contact support@openland.com.',
            uuid: uuid(),
            shouldRetry: true
        }]
    })
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

        if (message.protocol_v && typeof message.protocol_v === 'number') {
            if (message.protocol_v > 2 || message.protocol_v < 1) {
                socket.close();
                return;
            }
            session.protocolVersion = message.protocol_v;
        }

        session.setWaitingConnect();
        session.waitAuth = (async () => {
            session.authParams = await params.onAuth(message.payload, req);
            session.sendConnectionAck();

            // Create SpaceX Session
            let descriptor: SpaceXSessionDescriptor;
            if (session.authParams.uid) {
                descriptor = { type: 'authenticated', uid: session.authParams.uid, tid: session.authParams.tid };
            } else {
                descriptor = { type: 'anonymnous' };
            }
            session.session = new SpaceXSession({
                descriptor,
                schema: params.executableSchema
            });
            session.waitAuth = Promise.resolve();
            session.setConnected();
            asyncRun(async () => {
                while (session.isConnected()) {
                    session.sendKeepAlive();
                    await delay(5000);
                }
            });
            if (session.protocolVersion === 2) {
                asyncRun(async () => {
                    let timeout: NodeJS.Timeout | null = null;
                    while (session.isConnected()) {
                        // Send ping only if previous one was acknowledged
                        if (session.pingCounter !== session.pingAckCounter) {
                            await delay(1000 * 30);
                        }
                        session.sendPing();
                        if (timeout) {
                            clearTimeout(timeout);
                        }
                        timeout = setTimeout(() => {
                            if (session.isConnected() && Date.now() - session.lastPingAck > 1000 * 60 * 5) {
                                session.close();
                            }
                        }, 1000 * 60 * 5);
                        await delay(1000 * 30);
                    }
                });
            }
            let oldConnectionsTimeout = setTimeout(() => {
                if (!session.isConnected()) {
                    clearInterval(oldConnectionsTimeout);
                } else if (session.isConnected() && Date.now() - session.lastRequestTime > 1000 * 60 * 5) {
                    session.close();
                    clearInterval(oldConnectionsTimeout);
                }
            }, 1000 * 10);
        })();
    } else if (session.state === 'CONNECTED' || session.state === 'WAITING_CONNECT') {
        await Promise.resolve(session.waitAuth);
        session.lastRequestTime = Date.now();

        // TODO: add query validation
        if (message.type && message.type === 'start') {
            let operation = fetchGQlServerOperation(message.payload);
            let query: DocumentNode;
            if (message.payload.query_id && params.queryCache) {
                let cachedQuery = await params.queryCache.get(message.payload.query_id.trim());
                if (cachedQuery) {
                    query = parse(cachedQuery.query);
                } else {
                    session.send({ id: message.id, type: 'need_full_query' });
                    session.sendComplete(message.id);
                    return;
                }
            } else if (operation.query) {
                query = parse(message.payload.query);
                if (params.queryCache) {
                    await params.queryCache.store({ query: operation.query, name: operation.operationName });
                }
            } else {
                session.sendComplete(message.id);
                return;
            }

            // let query = parse(message.payload.query);
            let opType = getOperationType(query, operation.operationName);
            if (opType === 'subscription') {
                let working = true;
                let ctx = await params.subscriptionContext(session.authParams, operation, undefined, req);
                asyncRun(async () => {
                    await params.onOperation(ctx, operation);

                    if (!session.operationBucket.tryTake()) {
                        // handle error
                        session.sendRateLimitError(message.id);
                        session.sendComplete(message.id);
                        session.stopOperation(message.id);
                        return;
                    } else {
                        let iterator = await session.executionPool.run(async () => {
                            return gqlSubscribe({
                                schema: params.executableSchema,
                                document: query,
                                operationName: operation.operationName,
                                variableValues: operation.variables,
                                fetchContext: async () => await params.subscriptionContext(session.authParams, operation, ctx, req),
                                ctx,
                                onEventResolveFinish: (_ctx, duration) => params.onEventResolveFinish(_ctx, operation, duration)
                            });
                        });

                        if (!isAsyncIterator(iterator)) {
                            // handle error
                            session.sendData(message.id, await params.formatResponse(iterator, operation, ctx));
                            session.sendComplete(message.id);
                            session.stopOperation(message.id);
                            return;
                        }

                        for await (let event of iterator) {
                            if (!working) {
                                break;
                            }
                            session.sendData(message.id, await params.formatResponse(event, operation, ctx));
                        }
                        session.sendComplete(message.id);
                    }
                });
                session.addOperation(message.id, () => {
                    working = false;
                    cancelContext(ctx);
                });
            } else {
                let ctx = await params.context(session.authParams, operation, req);
                if (!session.operationBucket.tryTake()) {
                    // handle error
                    session.sendRateLimitError(message.id);
                    session.sendComplete(message.id);
                    session.stopOperation(message.id);
                    return;
                }
                await params.onOperation(ctx, operation);
                let opStartTime = Date.now();
                session.session.operation(ctx, query, operation.variables, (res) => {
                    if (res.type === 'data') {
                        session.sendData(message.id, params.formatResponse({ data: res.data }, operation, ctx));
                        session.sendComplete(message.id);
                        params.onOperationFinish(ctx, operation, Date.now() - opStartTime);
                    } else if (res.type === 'errors') {
                        session.sendData(message.id, params.formatResponse({ errors: res.errors }, operation, ctx));
                        session.sendComplete(message.id);
                        params.onOperationFinish(ctx, operation, Date.now() - opStartTime);
                    }
                });
            }
        } else if (message.type && message.type === 'stop') {
            session.stopOperation(message.id);
        } else if (message.type && message.type === 'connection_terminate') {
            session.close();
        } else if (message.type && message.type === 'ping' && session.protocolVersion === 2) {
            session.sendPingAck();
        } else if (message.type && message.type === 'pong' && session.protocolVersion === 2) {
            session.lastPingAck = Date.now();
            session.pingAckCounter++;
        }
    }
}

// const metric = createMetric('ws-connections', 'exact');
// const rootCtx = createNamedContext('apollo');

async function handleConnection(params: FuckApolloServerParams, sessions: Map<string, FuckApolloSession>, socket: WebSocket, req: http.IncomingMessage) {
    // metric.increment(rootCtx);
    let session = new FuckApolloSession(socket);
    sessions.set(session.id, session);
    let closed = false;
    Metrics.WebSocketConnections.inc();

    socket.on('message', async data => {
        Metrics.WebSocketPacketsIn.inc();
        await handleMessage(params, socket, req, session, JSON.parse(data.toString()));
    });
    socket.on('close', (code, reason) => {
        // logger.log(rootCtx, 'close connection', code, reason);
        session.close();
        sessions.delete(session.id);
        // console.log('close');
        if (!closed) {
            closed = true;
            Metrics.WebSocketConnections.dec();
        }
        // metric.decrement(rootCtx);
    });
    socket.on('error', (err) => {
        // logger.log(rootCtx, 'connection error', err);
        // metric.decrement(rootCtx);
        session.close();
        if (!closed) {
            closed = true;
            Metrics.WebSocketConnections.dec();
        }
    });
}

export async function createFuckApolloWSServer(params: FuckApolloServerParams) {
    let sessions = new Map<string, FuckApolloSession>();
    const ws = new WebSocket.Server(params.server ? { server: params.server, path: params.path } : { noServer: true });
    ws.on('connection', async (socket, req) => {
        await handleConnection(params, sessions, socket, req);
    });
    Shutdown.registerWork({
        name: 'fuck-apollo-ws',
        shutdown: async () => {
            ws.close();
        }
    });
    return { ws, sessions };
}
