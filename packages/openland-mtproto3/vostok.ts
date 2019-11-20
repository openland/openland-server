import WebSocket = require('ws');
import { createIterator } from '../openland-utils/asyncIterator';
import {
    decodeMessage, encodeAckMessages, encodeMessage, encodeMessagesInfoRequest, encodePing, isAckMessages,
    isGQLRequest,
    isGQLSubscription, isGQLSubscriptionStop,
    isInitialize, isMessage,
    KnownTypes, makeAckMessages,
    makeGQLResponse, makeGQLSubscriptionComplete,
    makeGQLSubscriptionResponse,
    makeInitializeAck,
    makeMessage, makeMessagesInfoRequest, makePing, MessageShape,
} from './schema/VostokTypes';
import * as http from 'http';
import * as https from 'https';
import { execute, GraphQLSchema, parse } from 'graphql';
import { QueryCache } from './queryCache';
import { Context, createNamedContext } from '@openland/context';
import { gqlSubscribe } from './gqlSubscribe';
import { isAsyncIterator } from './utils';
import { cancelContext } from '@openland/lifetime';
import { createLogger } from '@openland/log';
import Timeout = NodeJS.Timeout;
import { RotatingMap } from '../openland-utils/FixedSizeMap';
import { randomKey } from '../openland-utils/random';
import { randomBytes } from 'crypto';
import { delay } from '../openland-utils/timer';

const rootCtx = createNamedContext('vostok');
const log = createLogger('vostok');

// TODO
// Pings
// Multiply sockets in VostokConnection
// Sticky sessions
// Send events to connection with latest pong

interface Server {
    socket: WebSocket.Server;
    incomingConnections: AsyncIterable<VostokConnection>;
}

const makeMessageId = () => randomBytes(32).toString('hex');

class VostokConnection {
    protected socket: WebSocket|null = null;
    protected incoming = createIterator<MessageShape>(() => 0);

    readonly outcomingMessages = new RotatingMap<string, MessageShape>(1024);
    readonly incomingMessages = new RotatingMap<string, MessageShape>(1024);

    protected ackTimer: Timeout|null = null;

    public lastPingAck: number = Date.now();
    public pingCounter = 0;
    public pingAckCounter = 0;

    setSocket(socket: WebSocket) {
        this.socket = socket;
        socket.on('message', async data => this.onMessage(socket, data));
        socket.on('close', () => this.onSocketClose(socket));

        this.ackTimer = setInterval(() => {
            let ids = [...this.outcomingMessages.keys()];
            if (ids.length > 0) {
                this.sendRaw(encodeMessagesInfoRequest(makeMessagesInfoRequest({ ids })));
            }
        }, 5000);

        asyncRun(async () => {
            let timeout: NodeJS.Timeout|null = null;
            while (this.isConnected()) {
                // Send ping only if previous one was acknowledged
                if (this.pingCounter !== this.pingAckCounter) {
                    await delay(1000 * 30);
                }
                this.sendPing();
                if (timeout) {
                    clearTimeout(timeout);
                }
                timeout = setTimeout(() => {
                    if (this.isConnected() && Date.now() - this.lastPingAck > 1000 * 60 * 5) {
                        this.socket!.close();
                    }
                }, 1000 * 60 * 5);
                await delay(1000 * 30);
            }
        });
    }

    send(body: KnownTypes, acks?: string[]) {
        let message = makeMessage({ id: makeMessageId(), body, ackMessages: acks || null });
        log.log(rootCtx, '->', JSON.stringify(message));
        this.outcomingMessages.set(message.id, message);
        this.socket!.send(JSON.stringify(encodeMessage(message)));
    }

    sendAck(ids: string[]) {
        this.sendRaw(encodeAckMessages(makeAckMessages({ ids })));
    }

    close() {
        this.socket!.close();
    }

    getIterator() {
        this.incoming = createIterator<MessageShape>(() => 0);
        return this.incoming;
    }

    isConnected() {
        return this.socket!.readyState === this.socket!.OPEN;
    }

    sendPing() {
        this.sendRaw(encodePing(makePing({ id: ++this.pingAckCounter })));
    }

    private sendRaw(data: any) {
        this.socket!.send(JSON.stringify(data));
    }

    private onMessage(socket: WebSocket, data: WebSocket.Data) {
        log.log(rootCtx, '<-', data);
        let msgData = JSON.parse(data.toString());
        if (isMessage(msgData)) {
            let message = decodeMessage(msgData);
            this.incomingMessages.set(message.id, message);
            this.incoming.push(message);
        } else if (isAckMessages(msgData)) {
            for (let id of msgData.ids) {
                this.outcomingMessages.delete(id);
            }
        }
    }

    private onSocketClose(socket: WebSocket) {
        this.outcomingMessages.clear();
        this.incomingMessages.clear();
        this.incoming.complete();
        if (this.ackTimer) {
            clearInterval(this.ackTimer);
        }
    }
}

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

const asyncRun = (handler: () => Promise<any>) => {
    // tslint:disable-next-line:no-floating-promises
    handler();
};

class VostokSession {
    public state: 'init' | 'waiting_auth' | 'connected' = 'init';
    public authParams: any;
    public operations = new Map<string, { destroy(): void }>();
    public connections: { connection: VostokConnection }[] = [];
    public sessionId: string;
    private sessions: Map<string, VostokSession>;
    readonly incoming = createIterator<{ message: MessageShape, connection: VostokConnection }>(() => 0);

    constructor(sessionId: string, sessions: Map<string, VostokSession>) {
        this.sessionId = sessionId;
        this.sessions = sessions;
        log.log(rootCtx, 'session: ', this.sessionId);
    }

    switchToSession(sessionId: string) {
        log.log(rootCtx, 'switch session');
        this.stopAllOperations();
        if (this.sessions.has(sessionId)) {
            this.sessions.get(sessionId)!.addConnection(this.connections[0].connection);
            this.connections = [];
        }
        // handle if session not found
    }

    addOperation = (id: string, destroy: () => void) => {
        this.stopOperation(id);
        this.operations.set(id, { destroy });
    }

    stopOperation = (id: string) => {
        if (this.operations.has(id)) {
            this.operations.get(id)!.destroy();
            this.operations.delete(id);
        }
    }

    stopAllOperations = () => {
        for (let op of this.operations.entries())  {
            op[1].destroy();
            this.operations.delete(op[0]);
        }
    }

    addConnection(connection: VostokConnection) {
        let conn = { connection };
        this.connections.push(conn);
        asyncRun(async () => {
           for await (let message of connection.getIterator()) {
               this.incoming.push({ message, connection });
           }
           this.connections.splice(this.connections.findIndex(c => c === conn), 1);
        });
    }
}

function handleSession(session: VostokSession, params: VostokServerParams) {
    asyncRun(async () => {
        for await (let data of session.incoming) {
            let {message, connection} = data;

            if (session.state === 'init' && !isInitialize(message.body)) {
                connection.close();
                session.stopAllOperations();
            } else if (session.state === 'init' && isInitialize(message.body)) {
                session.state = 'waiting_auth';
                session.authParams = await params.onAuth(message.body.authToken);
                session.state = 'connected';
                if (message.body.sessionId) {
                    session.switchToSession(message.body.sessionId);
                    connection.send(makeInitializeAck({ sessionId: message.body.sessionId }), [message.id]);
                    return;
                }
                connection.send(makeInitializeAck({ sessionId: session.sessionId }), [message.id]);
            } else if (session.state !== 'connected') {
                continue; // maybe close connection?
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

                connection.send(makeGQLResponse({ id: message.body.id, result: JSON.stringify(result) }), [message.id]);
            } else if (isGQLSubscription(message.body)) {
                connection.sendAck([message.id]);
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
                        connection.send(makeGQLSubscriptionResponse({ id: message.body.id, result: JSON.stringify(await params.formatResponse(iterator)) }));
                        return;
                    }

                    for await (let event of iterator) {
                        if (!working) {
                            break;
                        }
                        connection.send(makeGQLSubscriptionResponse({ id: message.body.id, result: JSON.stringify(await params.formatResponse(event)) }));
                    }
                    connection.send(makeGQLSubscriptionComplete({ id: message.body.id }));
                });
                session.addOperation(message.body.id, () => {
                    working = false;
                    cancelContext(ctx);
                });
            } else if (isGQLSubscriptionStop(message.body)) {
                session.stopOperation(message.body.id);
                connection.sendAck([message.id]);
            }
        }
        session.stopAllOperations();
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

export function initVostok(params: VostokServerParams) {
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
    return server.socket;
}