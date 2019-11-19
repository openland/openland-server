import WebSocket = require('ws');
import { createIterator } from '../openland-utils/asyncIterator';
import {
    decodeMessage, encodeAckMessages, encodeMessage, encodeMessagesInfoRequest, isAckMessages,
    isGQLRequest,
    isGQLSubscription, isGQLSubscriptionStop,
    isInitialize, isMessage,
    KnownTypes, makeAckMessages,
    makeGQLResponse, makeGQLSubscriptionComplete,
    makeGQLSubscriptionResponse,
    makeInitializeAck,
    makeMessage, makeMessagesInfoRequest, MessageShape,
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

class VostokConnection {
    protected seq = 1;
    protected socket: WebSocket|null = null;
    readonly incoming = createIterator<MessageShape>(() => 0);

    readonly outcomingMessages = new RotatingMap<number, MessageShape>(1024);
    readonly incomingMessages = new RotatingMap<number, MessageShape>(1024);

    protected ackTimer: Timeout|null = null;

    setSocket(socket: WebSocket) {
        this.socket = socket;
        socket.on('message', async data => this.onMessage(socket, data));
        socket.on('close', () => this.onSocketClose(socket));

        this.ackTimer = setInterval(() => {
            let seqs = [...this.outcomingMessages.keys()];
            if (seqs.length > 0) {
                this.sendRaw(encodeMessagesInfoRequest(makeMessagesInfoRequest({ seqs })));
            }
        }, 5000);
    }

    send(body: KnownTypes, acks?: number[]) {
        let message = makeMessage({ seq: this.seq++, body, ackSeqs: acks || null });
        log.log(rootCtx, '->', JSON.stringify(message));
        this.outcomingMessages.set(message.seq, message);
        this.socket!.send(JSON.stringify(encodeMessage(message)));
    }

    sendAck(seqs: number[]) {
        this.sendRaw(encodeAckMessages(makeAckMessages({ seqs })));
    }

    close() {
        this.socket!.close();
    }

    private sendRaw(data: any) {
        this.socket!.send(JSON.stringify(data));
    }

    private onMessage(socket: WebSocket, data: WebSocket.Data) {
        log.log(rootCtx, '<-', data);
        let msgData = JSON.parse(data.toString());
        if (isMessage(msgData)) {
            let message = decodeMessage(msgData);
            this.incomingMessages.set(message.seq, message);
            this.incoming.push(message);
        } else if (isAckMessages(msgData)) {
            for (let seq of msgData.seqs) {
                this.outcomingMessages.delete(seq);
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
}

function handleConnect(connect: VostokConnection, params: VostokServerParams) {
    asyncRun(async () => {
        let session = new VostokSession();

        for await (let message of connect.incoming) {
            if (session.state === 'init' && !isInitialize(message.body)) {
                connect.close();
                session.stopAllOperations();
            } else if (session.state === 'init' && isInitialize(message.body)) {
                session.state = 'waiting_auth';
                session.authParams = await params.onAuth(message.body.authToken);
                session.state = 'connected';
                connect.send(makeInitializeAck({ }), [message.seq]);
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

                connect.send(makeGQLResponse({ id: message.body.id, result: JSON.stringify(result) }), [message.seq]);
            } else if (isGQLSubscription(message.body)) {
                connect.sendAck([message.seq]);
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
                        connect.send(makeGQLSubscriptionResponse({ id: message.body.id, result: JSON.stringify(await params.formatResponse(iterator)) }));
                        return;
                    }

                    for await (let event of iterator) {
                        if (!working) {
                            break;
                        }
                        connect.send(makeGQLSubscriptionResponse({ id: message.body.id, result: JSON.stringify(await params.formatResponse(event)) }));
                    }
                    connect.send(makeGQLSubscriptionComplete({ id: message.body.id }));
                });
                session.addOperation(message.body.id, () => {
                    working = false;
                    cancelContext(ctx);
                });
            } else if (isGQLSubscriptionStop(message.body)) {
                session.stopOperation(message.body.id);
                connect.sendAck([message.seq]);
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
    asyncRun(async () => {
        for await (let connect of server.incomingConnections) {
            handleConnect(connect, params);
        }
    });
    return server.socket;
}