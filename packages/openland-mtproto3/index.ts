import { execute, GraphQLSchema, parse, subscribe } from 'graphql';
import WebSocket = require('ws');
import * as http from 'http';
import * as https from 'https';
import { isAsyncIterator, isSubscriptionQuery } from './utils';

interface MTProtoServerParams {
    server: http.Server | https.Server;
    path: string;
    executableSchema: GraphQLSchema;
    onAuth(payload: any, req: http.IncomingMessage): Promise<any>;
    context(params: any): Promise<any>;
    genSessionId(authParams: any): Promise<string>;
}

const SessionsCache = new Map<string, MTProtoSession>();

//
//  MTProto3 protocol
//
//  Initialization
//  client: { type: "connection_init", auth_data: any, session_id?: string }
//  server: { type: "connection_ack", session_state: "new" | "restored", session_id: string, last_id: number }
//
//  Close session
//  client: { type: "connection_close", session_id?: string }

class MTProtoSession {
    public state: 'INIT' | 'WAITING_CONNECT' | 'CONNECTED' | 'SUSPENDED' = 'INIT';
    public authParams: any;
    public operations: { [operationId: string]: { destroy(): void } } = {};
    public waitAuth: Promise<any> = Promise.resolve();
    public socket: WebSocket;
    public sessionId: string|undefined;
    private cache: any[] = [];
    private lastId = 0;

    constructor(socket: WebSocket) {
        this.socket = socket;
    }

    setConnected() {
        this.state = 'CONNECTED';

        if (this.cache.length > 0) {
            for (let data of this.cache) {
                this.send(data);
            }
        }
    }

    setWaitingConnect() {
        this.state = 'WAITING_CONNECT';
    }

    setSuspended() {
        this.state = 'SUSPENDED';
    }

    setSocket(socket: WebSocket) {
        this.socket = socket;
    }

    send(data: any) {
        if (this.state !== 'SUSPENDED') {
            console.log('send', data);
            this.socket.send(JSON.stringify(data));
        } else {
            this.cache.push(data);
        }
    }

    setLastId(id: number) {
        if (id > this.lastId) {
            this.lastId = id;
        }
    }

    getLastId() {
        return this.lastId;
    }
}

async function handleMessage(params: MTProtoServerParams, socket: WebSocket, req: http.IncomingMessage, session: MTProtoSession, message: any) {
    if (session.state === 'INIT') {
        // handle auth here
        if (!message.type && message.type !== 'connection_init') {
            socket.close();
            return;
        }
        session.waitAuth = (async () => {
            session.setWaitingConnect();
            session.authParams = await params.onAuth(message.auth_data, req);
            let restoredSession = false;
            let sessionId: string;

            if (message.session_id && SessionsCache.has(message.session_id)) {
                console.log('got session from cache');

                session = SessionsCache.get(message.session_id)!;
                session.sessionId = message.session_id;
                session.setSocket(socket);
                session.setConnected();
                restoredSession = true;
                sessionId = message.session_id;
            } else {
                sessionId = await params.genSessionId(session.authParams);
                session.sessionId = sessionId;
                restoredSession = false;
                SessionsCache.set(sessionId, session);
            }

            session.send({
                type: 'connection_ack',
                session_state: restoredSession ? 'restored' : 'new',
                session_id: sessionId,
                last_id: session.getLastId()
            });
            session.waitAuth = Promise.resolve();
            session.setConnected();
        })();

    } else if (session.state === 'CONNECTED' || session.state === 'WAITING_CONNECT') {
        await Promise.resolve(session.waitAuth);

        if (message.type && message.type === 'start') {
            session.setLastId(message.id);
            let query = parse(message.payload.query);
            let isSubscription = isSubscriptionQuery(query, message.payload.operationName);

            if (isSubscription) {
                let working = true;
                (async () => {
                    let iterator = await subscribe({
                        schema: params.executableSchema,
                        document: query,
                        operationName: message.payload.operationName,
                        variableValues: message.payload.variables,
                        contextValue: await params.context(session.authParams)
                    });

                    if (!isAsyncIterator(iterator)) {
                        // handle error
                        session.send({id: message.id, type: 'data', payload: iterator });
                        session.send({id: message.id, type: 'complete', payload: null });
                        return;
                    }
                    for await (let event of iterator) {
                        if (!working) {
                            return;
                        }
                        session.send({id: message.id, type: 'data', payload: event });
                    }
                })();
                session.operations[message.id] = {
                    destroy: () => {
                        working = false;
                    }
                };
            } else {
                let result = await execute({
                    schema: params.executableSchema,
                    document: query,
                    operationName: message.payload.operationName,
                    variableValues: message.payload.variables,
                    contextValue: await params.context(session.authParams)
                });
                session.send({ id: message.id, type: 'data', payload: result });
                session.operations[message.id] = {
                    destroy: () => 0
                };
            }
        } else if (message.type && message.type === 'stop') {
            if (session.operations[message.id]) {
                session.operations[message.id].destroy();
                session.send({id: message.id, type: 'complete', payload: null });
            }
        } else if (message.type && message.type === 'connection_close') {
            for (let operationId in session.operations) {
                session.operations[operationId].destroy();
            }
            if (session.sessionId && SessionsCache.has(session.sessionId)) {
                SessionsCache.delete(session.sessionId);
            }
        }
    }
}

async function handleConnection(params: MTProtoServerParams, socket: WebSocket, req: http.IncomingMessage) {
    let session = new MTProtoSession(socket);

    socket.on('message', async data => {
        console.log('got data', data.toString());
        await handleMessage(params, socket, req, session, JSON.parse(data.toString()));
    });
    socket.on('close', (code, reason) => {
        console.log('close connection', code, reason);
        session.setSuspended();
    });
    socket.on('error', (err) => {
        console.log('connection error', err);
    });
}

export async function createMTProtoWSServer(params: MTProtoServerParams) {
    const ws = new WebSocket.Server({server: params.server, path: params.path});
    ws.on('connection', async (socket, req) => {
        await handleConnection(params, socket, req);
    });
}