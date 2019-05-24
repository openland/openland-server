import {
    createSourceEventStream,
    DocumentNode,
    execute,
    GraphQLFieldResolver,
    GraphQLSchema,
    parse,
} from 'graphql';
import WebSocket = require('ws');
import * as http from 'http';
import * as https from 'https';
import { isAsyncIterator, isSubscriptionQuery } from './utils';
import { delay } from '../openland-utils/timer';
import Maybe from 'graphql/tsutils/Maybe';

interface FuckApolloServerParams {
    server?: http.Server | https.Server;
    path: string;
    executableSchema: GraphQLSchema;

    onAuth(payload: any, req: http.IncomingMessage): Promise<any>;

    context(params: any): Promise<any>;

    genSessionId(authParams: any): Promise<string>;

    formatResponse(response: any): Promise<any>;
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

    setConnected() {
        this.state = 'CONNECTED';
    }

    setWaitingConnect() {
        this.state = 'WAITING_CONNECT';
    }

    send(data: any) {
        this.socket.send(JSON.stringify(data));
    }
}

async function handleMessage(params: FuckApolloServerParams, socket: WebSocket, req: http.IncomingMessage, session: FuckApolloSession, message: any) {

    const stopOperation = (id: string) => {
        session.operations[id].destroy();
        delete session.operations[id];
    };

    if (session.state === 'INIT') {
        // handle auth here
        if (!message.type || message.type !== 'connection_init') {
            socket.close();
            return;
        }

        session.setWaitingConnect();
        session.waitAuth = (async () => {
            session.authParams = await params.onAuth(message.payload, req);
            session.send({type: 'connection_ack'});
            session.waitAuth = Promise.resolve();
            session.setConnected();
            // tslint:disable-next-line:no-floating-promises
            (async () => {
                while (session.socket.readyState === WebSocket.OPEN && session.state === 'CONNECTED') {
                    session.send({type: 'ka'});
                    await delay(5000);
                }
            })();
        })();

    } else if (session.state === 'CONNECTED' || session.state === 'WAITING_CONNECT') {
        await Promise.resolve(session.waitAuth);

        if (message.type && message.type === 'start') {
            let query = parse(message.payload.query);
            let isSubscription = isSubscriptionQuery(query, message.payload.operationName);

            if (isSubscription) {
                let working = true;
                // tslint:disable-next-line:no-floating-promises
                (async () => {
                    let iterator = await subscribeImpl({
                        schema: params.executableSchema,
                        document: query,
                        operationName: message.payload.operationName,
                        variableValues: message.payload.variables,
                        contextValue: async () => await params.context(session.authParams)
                    });

                    if (!isAsyncIterator(iterator)) {
                        // handle error
                        session.send({id: message.id, type: 'data', payload: await params.formatResponse(iterator)});
                        session.send({id: message.id, type: 'complete', payload: null});
                        stopOperation(message.id);
                        return;
                    }
                    for await (let event of iterator) {
                        if (!working) {
                            session.send({id: message.id, type: 'complete', payload: null});
                            return;
                        }
                        session.send({id: message.id, type: 'data', payload: await params.formatResponse(event)});
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
                session.send({id: message.id, type: 'data', payload: await params.formatResponse(result)});
                session.send({id: message.id, type: 'complete', payload: null});
            }
        } else if (message.type && message.type === 'stop') {
            if (session.operations[message.id]) {
                stopOperation(message.id);
            }
        } else if (message.type && message.type === 'connection_terminate') {
            for (let operationId in session.operations) {
                stopOperation(operationId);
            }
        }
    }
}

async function handleConnection(params: FuckApolloServerParams, socket: WebSocket, req: http.IncomingMessage) {
    let session = new FuckApolloSession(socket);

    const stopAllOperations = () => {
        for (let operationId in session.operations) {
            session.operations[operationId].destroy();
            delete session.operations[operationId];
        }
    };

    socket.on('message', async data => {
        await handleMessage(params, socket, req, session, JSON.parse(data.toString()));
    });
    socket.on('close', (code, reason) => {
        console.log('close connection', code, reason);
        stopAllOperations();
    });
    socket.on('error', (err) => {
        console.log('connection error', err);
        stopAllOperations();
    });
}

export async function createFuckApolloWSServer(params: FuckApolloServerParams) {
    const ws = new WebSocket.Server(params.server ? {server: params.server, path: params.path} : {noServer: true});
    ws.on('connection', async (socket, req) => {
        await handleConnection(params, socket, req);
    });
    return ws;
}

async function * subscribeImpl(
    {
        schema,
        document,
        rootValue,
        contextValue,
        variableValues,
        operationName,
        fieldResolver,
        subscribeFieldResolver,
    }: {
        schema: GraphQLSchema;
        document: DocumentNode;
        rootValue?: any;
        contextValue?: () => Promise<any>;
        variableValues?: Maybe<{ [key: string]: any }>;
        operationName?: Maybe<string>;
        fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
        subscribeFieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
    }) {

    const sourcePromise = createSourceEventStream(
        schema,
        document,
        rootValue,
        contextValue ? await contextValue() : undefined,
        variableValues as any,
        operationName,
        subscribeFieldResolver,
    );

    const mapSourceToResponse = async (payload: any) => execute(
        schema,
        document,
        payload,
        contextValue ? await contextValue() : undefined,
        variableValues,
        operationName,
        fieldResolver,
    );

    let res = await sourcePromise;

    if (isAsyncIterator(res)) {
        try {
            for await (let data of res) {
                yield await mapSourceToResponse(data);
            }
        } catch (e) {
            yield { errors: [e] };
        }
    } else {
        return res;
    }
}
