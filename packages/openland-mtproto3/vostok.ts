import WebSocket = require('ws');
import { createIterator } from '../openland-utils/asyncIterator';
import {
    decodeMessage, encodeAckMessages, encodeMessage, encodeMessagesInfoRequest, encodePing, isAckMessages,
    isGQLRequest,
    isGQLSubscription, isGQLSubscriptionStop,
    isInitialize, isMessage, isPong,
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
import { cancelContext, forever, withLifetime } from '@openland/lifetime';
import { createLogger } from '@openland/log';
import Timeout = NodeJS.Timeout;
import { RotatingMap } from '../openland-utils/FixedSizeMap';
import { randomKey } from '../openland-utils/random';
import { randomBytes } from 'crypto';
import { delay } from '../openland-utils/timer';

const rootCtx = createNamedContext('vostok');
const log = createLogger('vostok');

interface Server {
    socket: WebSocket.Server;
    incomingConnections: AsyncIterable<VostokConnection>;
}

const makeMessageId = () => randomBytes(32).toString('hex');

const asyncRun = (handler: () => Promise<any>) => {
    // tslint:disable-next-line:no-floating-promises
    handler();
};

const PING_TIMEOUT = 1000 * 30;
const PING_CLOSE_TIMEOUT = 1000 * 60 * 5;

// const PING_TIMEOUT = 1000;
// const PING_CLOSE_TIMEOUT = 1000 * 5;

class VostokConnection {
    protected socket: WebSocket|null = null;
    protected incoming = createIterator<any>(() => 0);

    protected ackTimer: Timeout|null = null;

    public lastPingAck: number = Date.now();
    public pingCounter = 0;
    public pingAckCounter = 0;

    setSocket(socket: WebSocket) {
        this.socket = socket;
        socket.on('message', async data => this.onMessage(socket, data));
        socket.on('close', () => this.onSocketClose());

        asyncRun(async () => {
            let timeout: NodeJS.Timeout|null = null;
            while (this.isConnected()) {
                // Send ping only if previous one was acknowledged
                if (this.pingCounter !== this.pingAckCounter) {
                    await delay(PING_TIMEOUT);
                    continue;
                }
                this.sendPing();
                if (timeout) {
                    clearTimeout(timeout);
                }
                timeout = setTimeout(() => {
                    if (this.isConnected() && Date.now() - this.lastPingAck > PING_CLOSE_TIMEOUT) {
                        this.socket!.close();
                    }
                }, PING_CLOSE_TIMEOUT);
                await delay(PING_TIMEOUT);
            }
        });
    }

    close() {
        this.socket!.close();
        this.onSocketClose();
    }

    getIterator() {
        this.incoming = createIterator<KnownTypes>(() => 0);
        return this.incoming;
    }

    isConnected() {
        return this.socket!.readyState === this.socket!.OPEN;
    }

    sendPing() {
        this.sendRaw(encodePing(makePing({ id: ++this.pingCounter })));
    }

    sendRaw(data: any) {
        this.socket!.send(JSON.stringify(data));
    }

    private onMessage(socket: WebSocket, data: WebSocket.Data) {
        log.log(rootCtx, '<-', data);
        let msgData = JSON.parse(data.toString());
        if (isPong(msgData)) {
            this.lastPingAck = Date.now();
            this.pingAckCounter++;
        } else {
            this.incoming.push(msgData);
        }
    }

    private onSocketClose() {
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

class VostokOperationsManager {
    public operations = new Map<string, { destroy(): void }>();

    add = (id: string, destroy: () => void) => {
        this.stop(id);
        this.operations.set(id, { destroy });
    }

    stop = (id: string) => {
        if (this.operations.has(id)) {
            this.operations.get(id)!.destroy();
            this.operations.delete(id);
        }
        log.log(rootCtx, 'attempt to stop unknown operation', id);
    }

    stopAll = () => {
        for (let op of this.operations.entries())  {
            op[1].destroy();
            this.operations.delete(op[0]);
        }
    }
}

class VostokSession {
    public sessionId: string;
    public state: 'init' | 'waiting_auth' | 'connected' | 'closed' = 'init';
    public authParams: any;
    public operations = new VostokOperationsManager();
    public connections: { connection: VostokConnection }[] = [];
    public noConnectsSince: number|null = null;

    readonly incoming = createIterator<{ message: MessageShape, connection: VostokConnection }>(() => 0);

    readonly waitingDelivery: MessageShape[] = [];
    readonly outcomingMessages = new RotatingMap<string, { msg: MessageShape, delivered: boolean }>(1024);
    readonly incomingMessages = new RotatingMap<string, MessageShape>(1024);

    private sessions: Map<string, VostokSession>;
    private ctx = withLifetime(createNamedContext('vostok-session'));

    constructor(sessionId: string, sessions: Map<string, VostokSession>) {
        this.sessionId = sessionId;
        this.sessions = sessions;
        log.log(rootCtx, 'session: ', this.sessionId);

        this.setupAckLoop();
    }

    setupAckLoop() {
        forever(this.ctx, async () => {
            let ids = [...this.outcomingMessages.keys()];
            if (ids.length > 0) {
                this.sendRaw(encodeMessagesInfoRequest(makeMessagesInfoRequest({ ids })));
            }
            await delay(5000);
        });
    }

    send(body: KnownTypes, acks?: string[]) {
        let message = makeMessage({ id: makeMessageId(), body, ackMessages: acks || null });
        let connect = this.freshestConnect();
        let delivered = false;

        if (connect && connect.connection.isConnected()) {
            log.log(rootCtx, '->', JSON.stringify(message));
            connect.connection.sendRaw(encodeMessage(message));
            delivered = true;
        } else {
            log.log(rootCtx, '?->', JSON.stringify(message));
            this.waitingDelivery.push(message);
        }
        this.outcomingMessages.set(message.id, { msg: message, delivered });

        return message;
    }

    // has no delivery guarantee
    sendRaw(data: any) {
        if (this.freshestConnect()) {
            this.freshestConnect().connection.sendRaw(data);
        }
    }

    sendAck(ids: string[]) {
        this.sendRaw(encodeAckMessages(makeAckMessages({ ids })));
    }

    deliverQueuedMessages() {
        let len = this.waitingDelivery.length;
        for (let msg of this.waitingDelivery) {
            this.send(msg.body, msg.ackMessages || undefined);
        }
        this.waitingDelivery.splice(0, len);
    }

    addConnection(connection: VostokConnection) {
        let conn = { connection };
        this.connections.push(conn);
        this.noConnectsSince = null;
        this.deliverQueuedMessages();

        asyncRun(async () => {
           for await (let msgData of connection.getIterator()) {
               if (isMessage(msgData)) {
                   let message = decodeMessage(msgData);
                   this.incomingMessages.set(message.id, message);
                   this.incoming.push({ message, connection });
               } else if (isAckMessages(msgData)) {
                   for (let id of msgData.ids) {
                       this.outcomingMessages.delete(id);
                   }
               }
           }

           this.connections.splice(this.connections.findIndex(c => c === conn), 1);

           if (this.connections.length === 0) {
               this.noConnectsSince = Date.now();
           }
        });
    }

    switchToSession(messageId: string, sessionId: string) {
        log.log(rootCtx, 'switch session');
        let switched = false;

        let target = this.sessions.get(sessionId);
        if (target) {
            target.addConnection(this.connections[0].connection);
            target.send(makeInitializeAck({ sessionId }), [messageId]);
            this.connections = [];
            switched = true;
        }
        this.destroy();
        log.log(rootCtx, 'attempt to switch to unknown session');
        return switched;
    }

    destroy = () => {
        if (this.state === 'closed') {
            return;
        }
        this.state = 'closed';
        cancelContext(this.ctx);
        this.operations.stopAll();
        this.incomingMessages.clear();
        this.outcomingMessages.clear();
        this.incoming.complete();
        this.connections.forEach(c => c.connection.close());
        this.connections = [];
        this.noConnectsSince = Date.now();
    }

    private freshestConnect() {
        let connects = this.connections.sort((a, b) => b.connection.lastPingAck - b.connection.lastPingAck);
        return connects[0];
    }
}

function handleSession(session: VostokSession, params: VostokServerParams) {
    asyncRun(async () => {
        for await (let data of session.incoming) {
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

const EMPTY_SESSION_TTL = 1000 * 5;

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