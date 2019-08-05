import * as bodyParser from 'body-parser';
import express from 'express';
import cors from 'cors';
// import morgan from 'morgan';
import * as Auth2 from '../openland-module-auth/authV2';
import * as Auth from '../openland-module-auth/providers/email';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { Schema } from './schema/Schema';
import { execute, subscribe, GraphQLSchema, DocumentNode, GraphQLFieldResolver, OperationDefinitionNode } from 'graphql';
import { fetchWebSocketParameters, buildWebSocketContext } from './handlers/websocket';
import { errorHandler, QueryInfo } from '../openland-errors';
import { Server as HttpServer } from 'http';
import { withAudit } from '../openland-module-auth/providers/email';
import { IDs } from './IDs';
import { Modules } from 'openland-modules/Modules';
import { AppContext } from 'openland-modules/AppContext';
import { createTracer } from 'openland-log/createTracer';
import { initSafariPush } from '../openland-module-push/safari/handlers';
import { initAppHandlers } from '../openland-module-apps/Apps.handler';
import { ApolloServer } from 'apollo-server-express';
import { callContextMiddleware } from './handlers/context';
import * as http from 'http';
import { TokenChecker } from '../openland-module-auth/authV2';
import { parseCookies } from '../openland-utils/parseCookies';
import { decode } from 'openland-utils/base64';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { createFuckApolloWSServer } from '../openland-mtproto3';
import * as url from 'url';
import { buildConcurrencyPool } from './buildConcurrencyPool';
import { withConcurrentcyPool } from 'openland-utils/ConcurrencyPool';
import { createNamedContext } from '@openland/context';
import { createLogger, withLogPath } from '@openland/log';
import { withReadOnlyTransaction, inTx } from '@openland/foundationdb';
import { GqlQueryIdNamespace, withGqlQueryId, withGqlTrace } from '../openland-graphql/gqlTracer';
// import { AuthContext } from '../openland-module-auth/AuthContext';
import { uuid } from '../openland-utils/uuid';
// import { createFuckApolloWSServer } from '../openland-mtproto3';
// import { randomKey } from '../openland-utils/random';

// const loggerWs = createLogger('ws');
const ws = createTracer('ws');
const integrationCtx = createNamedContext('integration-ctx');
const logger = createLogger('api-module');

export async function initApi(isTest: boolean) {
    const rootCtx = createNamedContext('init');
    logger.log(rootCtx, 'Starting...');

    //
    // Fetching Port
    //
    let port = process.env.PORT;
    let dport = 9000;
    if (port !== undefined && port !== '') {
        dport = parseInt(process.env.PORT as string, 10);
    }
    if (isTest) {
        dport = 0;
    }

    //
    // Middlewares
    //

    const app = express();

    app.enable('trust proxy');

    // Basic Configuration
    if (!isTest) {
        app.use(cors());
        // app.use(morgan('tiny'));
        // app.use(compression());
    }

    // To avoid logging on this route
    app.get('/', (req, res) => res.send('Welcome to Openland API!'));
    app.get('/status', (req, res) => res.send('Welcome to Openland API!'));
    app.get('/favicon.ico', (req, res) => res.send(404));
    app.get('/robots.txt', (req, res) => res.send(404));

    //
    // Authenticaton
    //
    app.post('/v2/auth', Auth2.JWTChecker, bodyParser.json(), Auth2.Authenticator);

    app.post('/auth/sendCode', bodyParser.json(), withAudit(Auth.sendCode));
    app.post('/auth/checkCode', bodyParser.json(), withAudit(Auth.checkCode));
    app.post('/auth/getAccessToken', bodyParser.json(), withAudit(Auth.getAccessToken));

    //
    //  Safari push
    //
    initSafariPush(app);

    //
    //  Apps
    //
    initAppHandlers(app);

    //
    // Semaphore bot
    //
    app.post('/semaphorebot', bodyParser.json(), (async (req, res) => {
        await inTx(integrationCtx, async (ctx) => {
            let chatId = IDs.Conversation.parse('zoqLwdzr6VHelWZOR6JatW4aak');
            let botId = IDs.User.parse('vmM5pE5lQ4udYLr6AOLBhdQDJK');
            let data = req.body;

            if (data.result === 'passed') {
                let text = `${data.commit.author_name} ${data.event === 'deploy' ? 'deployed' : 'build'} :tada: - ${data.commit.message} to ${data.project_name}`;

                await Modules.Messaging.sendMessage(ctx, chatId, botId, { message: text });
            }
        });
    }));

    //
    // Graphana alerts
    //
    app.post('/graphanaAlerts', bodyParser.json(), (async (req, res) => {
        let authRaw = req.headers.authorization;
        if (!authRaw || decode(authRaw!.split(' ')[1]) !== 'grfana:d138df93-758a-4e8c-be8f-e46ecf09eeb4') {
            throw new AccessDeniedError();
        }
        await inTx(integrationCtx, async (ctx) => {
            let chatId = IDs.Conversation.parse('M6Pl7R30rECQn7a9OP4MHrqYdo');
            let botId = IDs.User.parse('LOaDEWDjZQfjVm3P7Ro4CYgMAD');
            let data = req.body;

            let text = data.title + '\n' + data.message + (data.imageUrl ? '\n' + data.imageUrl : '') + (data.state === 'ok' ? '\nОтпустило кажется' : '');
            await Modules.Messaging.sendMessage(ctx, chatId, botId, { message: text });
        });
    }));

    const Server = new ApolloServer({
        schema: Schema(),
        introspection: true,
        tracing: process.env.NODE_ENV !== 'production',
        formatError: (err: any) => {
            logger.warn(rootCtx, err);
            return {
                ...errorHandler(err),
                locations: err.locations,
                path: err.path
            };
        },
        context: async (context) => {
            let ctx = context as any;
            // WS
            if (ctx.connection) {
                let wsctx = ctx.connection.context;
                let ctx2 = buildWebSocketContext(wsctx || {});
                return withConcurrentcyPool(ctx2, buildConcurrencyPool(ctx2));
            }
            await TokenChecker(context.req, context.res);
            await callContextMiddleware(isTest, context.req, context.res);

            return context.res.locals.ctx;
        },
        // subscriptions: {
        //     onConnect: async (connectionParams, websocket, context) => {
        //         return await fetchWebSocketParameters(connectionParams, websocket);
        //     },
        //     path: '/api',
        // },
        playground: {
            endpoint: process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000/graphql',
            settings: {
                'request.credentials': 'include'
            } as any
        }
    });

    // Starting Api
    if (dport > 0) {
        logger.log(rootCtx, 'Binding to port ' + dport);

        let formatError = (err: any, info?: QueryInfo) => {
            logger.warn(rootCtx, err);
            return {
                ...errorHandler(err, info),
                locations: err.locations,
                path: err.path
            };
        };

        function createWebSocketServer(server: HttpServer) {
            return new SubscriptionServer({
                schema: Schema(),
                execute: async (schema: GraphQLSchema, document: DocumentNode, rootValue?: any, contextValue?: any, variableValues?: {
                    [key: string]: any;
                }, operationName?: string, fieldResolver?: GraphQLFieldResolver<any, any>) => {
                    let ex = document.definitions.find((v) => v.kind === 'OperationDefinition');
                    let srcCtx = (contextValue as AppContext).ctx;
                    if (ex && (ex as OperationDefinitionNode).operation !== 'subscription') {
                        srcCtx = withReadOnlyTransaction(srcCtx);
                    }

                    srcCtx = withConcurrentcyPool(srcCtx, buildConcurrencyPool((contextValue as AppContext)));

                    return await ws.trace(srcCtx, operationName || 'op', async (ctx) => {
                        return await execute(schema, document, rootValue, new AppContext(ctx), variableValues, operationName, fieldResolver);
                    });
                },
                subscribe,
                keepAlive: 10000,
                onConnect: async (args: any, webSocket: any) => {
                    let wsParams = await fetchWebSocketParameters(args || {}, webSocket);

                    if (Object.keys(wsParams).length === 0 && webSocket.upgradeReq.headers.cookie && webSocket.upgradeReq.headers.cookie.length > 0) {
                        let cookies = parseCookies(webSocket.upgradeReq.headers.cookie);
                        wsParams = await fetchWebSocketParameters({ 'x-openland-token': cookies['x-openland-token'] }, webSocket);
                    }
                    webSocket.__params = wsParams;
                },
                onOperation: async (message: any, params: any, webSocket: any) => {
                    let ctx = buildWebSocketContext(webSocket.__params);
                    // if (!isTest) {
                    //     if (webSocket.__params.uid) {
                    //         loggerWs.log(ctx, 'GraphQL [#' + webSocket.__params.uid + ']: ' + JSON.stringify(message.payload));
                    //     } else {
                    //         loggerWs.log(ctx, 'WS GraphQL [#ANON]: ' + JSON.stringify(message.payload));
                    //     }
                    // }

                    // let clientId = '';

                    // if (webSocket.__params.uid) {
                    //     clientId = 'user_' + webSocket.__params.uid;
                    // } else {
                    //     clientId = 'ip_' + webSocket._socket.remoteAddress;
                    // }

                    // let handleStatus = Rate.WS.canHandle(clientId);

                    // if (!handleStatus.canHandle) {
                    //     if (handleStatus.delay) {
                    //         Rate.WS.hit(clientId);
                    //         await delay(handleStatus.delay);
                    //     } else {
                    //         throw new Error('Rate limit!');
                    //     }
                    // } else {
                    //     Rate.WS.hit(clientId);
                    // }

                    return {
                        ...params,
                        context: ctx,
                        formatResponse: (value: any) => {
                            let errors: any[] | undefined;
                            if (value.errors) {
                                let info: QueryInfo = {
                                    uid: ctx && ctx.auth && ctx.auth.uid,
                                    oid: ctx && ctx.auth && ctx.auth.oid,
                                    query: JSON.stringify(message.payload),
                                    transport: 'ws'
                                };
                                errors = value.errors && value.errors.map((e: any) => formatError(e, info));
                            }
                            return ({
                                ...value,
                                errors: errors,
                            });
                        }
                    };
                },
                validationRules: [
                    // disableIntrospection(undefined) // any introspection over WS is disabled
                ]
            }, {
                    // server: server,
                    // path: '/api'
                    noServer: true,
                });
        }

        // Starting server
        const httpServer = http.createServer(app);

        Server.applyMiddleware({ app, path: '/graphql' });
        Server.applyMiddleware({ app, path: '/api' });

        createWebSocketServer(httpServer);
        // const wsCtx = createNamedContext('ws-gql');
        let fuckApolloWS = await createFuckApolloWSServer({
            server: undefined, // httpServer ,
            path: '/api',
            executableSchema: Schema(),
            onAuth: async (params, req) => {
                if (!params || Object.keys(params).length === 0 && req.headers.cookie && req.headers.cookie.length > 0) {
                    let cookies = parseCookies(req.headers.cookie || '');
                    return await fetchWebSocketParameters({ 'x-openland-token': cookies['x-openland-token'] }, null);
                }
                return await fetchWebSocketParameters(params, null);
            },
            context: async (params, operation) => {
                let opId = uuid();
                let ctx = buildWebSocketContext(params || {}).ctx;
                ctx = withReadOnlyTransaction(ctx);
                ctx = withLogPath(ctx, `query ${opId} ${operation.operationName || ''}`);
                ctx = withGqlQueryId(ctx, opId);
                ctx = withGqlTrace(ctx, `query ${opId} ${operation.operationName || ''}`);

                return new AppContext(ctx);
            },
            subscriptionContext: async (params, operation, firstCtx) => {
                let opId = firstCtx ? GqlQueryIdNamespace.get(firstCtx)! : uuid();
                let ctx = buildWebSocketContext(params || {}).ctx;
                ctx = withReadOnlyTransaction(ctx);
                ctx = withLogPath(ctx, `subscription ${opId} ${operation.operationName || ''}`);
                ctx = withGqlQueryId(ctx, opId);
                ctx = withGqlTrace(ctx, `subscription ${opId} ${operation.operationName || ''}`);

                return new AppContext(ctx);
            },
            onOperation: async (ctx, operation) => {
                // if (!isTest) {
                //     let opId = GqlQueryIdNamespace.get(ctx) || 'unknown query';
                //     if (AuthContext.get(ctx).uid) {
                //         logger.log(wsCtx, `GraphQL ${opId} [#${AuthContext.get(ctx).uid}]: ${JSON.stringify(operation)}`);
                //     } else {
                //         logger.log(wsCtx, `GraphQL ${opId} [#ANON]: ${JSON.stringify(operation)}`);
                //     }
                // }
            },
            formatResponse: async value => {
                let errors: any[] | undefined;
                if (value.errors) {
                    errors = value.errors && value.errors.map((e: any) => formatError(e));
                }
                return ({
                    ...value,
                    errors: errors,
                });
            }
        });

        httpServer.on('upgrade', (request, socket, head) => {
            const pathname = url.parse(request.url).pathname;

            if (pathname === '/api') {
                fuckApolloWS.handleUpgrade(request, socket, head, (_ws) => {
                    fuckApolloWS.emit('connection', _ws, request);
                });
            } else if (pathname === '/gql_ws') {
                fuckApolloWS.handleUpgrade(request, socket, head, (_ws) => {
                    fuckApolloWS.emit('connection', _ws, request);
                });
            } else {
                socket.destroy();
            }
        });
        httpServer.listen(dport);
    } else {
        await new Promise((resolver) => app.listen(0, () => resolver()));
    }

    return app;
}
