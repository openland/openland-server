import { execute, GraphQLSchema, parse, subscribe } from 'graphql';
import WebSocket = require('ws');
import * as http from 'http';
import * as https from 'https';
import { isAsyncIterator, isSubscriptionQuery } from './utils';

interface MTProtoServerParams {
    server: http.Server | https.Server;
    path: string;
    executableSchema: GraphQLSchema;
    onAuth(payload: any): Promise<any>;
    context(params: any): Promise<any>;
}

class MTProtoSession {
    public state: 'INIT' | 'WAITING_CONNECT' | 'CONNECTED' = 'INIT';
    public authParams: any;
    public operations: { [operationId: string]: { destroy(): void } } = {};
    public waitAuth: Promise<any> = Promise.resolve();

    setConnected() {
        this.state = 'CONNECTED';
    }

    setWaitingConnect() {
        this.state = 'WAITING_CONNECT';
    }
}

async function handleMessage(params: MTProtoServerParams, socket: WebSocket, session: MTProtoSession, message: any) {
    const send = (data: any) => socket.send(JSON.stringify(data));

    if (session.state === 'INIT') {
        // handle auth here
        if (!message.type && message.type !== 'connection_init') {
            socket.close();
            return;
        }
        session.waitAuth = (async () => {
            session.setWaitingConnect();
            session.authParams = await params.onAuth(message.payload);
            send({type: 'connection_ack'});
            session.waitAuth = Promise.resolve();
            session.setConnected();
        })();

    } else if (session.state === 'CONNECTED' || session.state === 'WAITING_CONNECT') {
        await Promise.resolve(session.waitAuth);

        if (message.type && message.type === 'start') {
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
                        send({id: message.id, type: 'data', payload: iterator });
                        send({id: message.id, type: 'complete', payload: null });
                        return;
                    }
                    for await (let event of iterator) {
                        if (!working) {
                            return;
                        }
                        send({id: message.id, type: 'data', payload: event });
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
                send({ id: message.id, type: 'data', payload: result });
                session.operations[message.id] = {
                    destroy: () => 0
                };
            }
        } else if (message.type && message.type === 'stop') {
            if (session.operations[message.id]) {
                session.operations[message.id].destroy();
                send({id: message.id, type: 'complete', payload: null });
            }
        }
    }
}

async function handleConnection(params: MTProtoServerParams, socket: WebSocket) {
    let session = new MTProtoSession();

    socket.on('message', async data => {
        console.log('got data', data.toString());
        await handleMessage(params, socket, session, JSON.parse(data.toString()));
    });
    socket.on('close', (code, reason) => {
        console.log('close connection', code, reason);
    });
    socket.on('error', (err) => {
        console.log('connection error', err);
    });
}

export async function createMTProtoWSServer(params: MTProtoServerParams) {
    const ws = new WebSocket.Server({server: params.server, path: params.path});
    ws.on('connection', async (socket) => {
        await handleConnection(params, socket);
    });
}