import * as bodyParser from 'body-parser';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
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
import { inTx } from 'foundation-orm/inTx';
import { Modules } from 'openland-modules/Modules';
import { createLogger } from 'openland-log/createLogger';
import { createEmptyContext } from 'openland-utils/Context';
import { AppContext } from 'openland-modules/AppContext';
import { createTracer } from 'openland-log/createTracer';
import { withCache } from 'foundation-orm/withCache';
import { initSafariPush } from '../openland-module-push/safari/handlers';
import { initAppHandlers } from '../openland-module-apps/Apps.handler';
import { ApolloServer } from 'apollo-server-express';
import { callContextMiddleware } from './handlers/context';
import * as http from 'http';
import { TokenChecker } from '../openland-module-auth/authV2';

const logger = createLogger('ws');
const ws = createTracer('ws');

export async function initApi(isTest: boolean) {

    console.info('Starting...');

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

    // Fetchin Apollo Engine
    let engineKey = process.env.APOLLO_ENGINE_KEY;
    if (engineKey) {
        console.log('Starting with Apollo Engine');
    }

    //
    // Middlewares
    //

    const app = express();

    app.enable('trust proxy');

    // Basic Configuration
    if (!isTest) {
        app.use(cors());
        app.use(morgan('tiny'));
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
        await inTx(createEmptyContext(), async (ctx) => {
            let chatId = IDs.Conversation.parse('zoqLwdzr6VHelWZOR6JatW4aak');
            let botId = IDs.User.parse('vmM5pE5lQ4udYLr6AOLBhdQDJK');
            let data = req.body;

            if (data.result === 'passed') {
                let text = `${data.commit.author_name} ${data.event === 'deploy' ? 'deployed' : 'build'} :tada: - ${data.commit.message} to ${data.project_name}`;

                await Modules.Messaging.sendMessage(ctx, chatId, botId, { message: text });
            }
        });
    }));

    const Server = new ApolloServer({
        schema: Schema(),
        introspection: true,
        formatError: (err: any) => {
            console.warn(err);
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
                return ctx2;
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
        console.info('Binding to port ' + dport);

        let formatError = (err: any, info: QueryInfo) => {
            console.warn(err);
            return {
                ...errorHandler(err, info),
                locations: err.locations,
                path: err.path
            };
        };

        function createWebSocketServer(server: HttpServer) {
            new SubscriptionServer({
                schema: Schema(),
                execute: async (schema: GraphQLSchema, document: DocumentNode, rootValue?: any, contextValue?: any, variableValues?: {
                    [key: string]: any;
                }, operationName?: string, fieldResolver?: GraphQLFieldResolver<any, any>) => {
                    let ex = document.definitions.find((v) => v.kind === 'OperationDefinition');
                    let srcCtx = (contextValue as AppContext).ctx;
                    if (ex && (ex as OperationDefinitionNode).operation !== 'subscription') {
                        srcCtx = withCache(srcCtx);
                    }
                    return await ws.trace(srcCtx, operationName || 'op', async (ctx) => {
                        return await execute(schema, document, rootValue, new AppContext(ctx), variableValues, operationName, fieldResolver);
                    });
                },
                subscribe,
                keepAlive: 10000,
                onConnect: async (args: any, webSocket: any) => {
                    webSocket.__params = await fetchWebSocketParameters(args, webSocket);
                },
                onOperation: async (message: any, params: any, webSocket: any) => {
                    let ctx = buildWebSocketContext(webSocket.__params);
                    if (!isTest) {
                        if (webSocket.__params.uid) {
                            logger.log(ctx, 'GraphQL [#' + webSocket.__params.uid + ']: ' + JSON.stringify(message.payload));
                        } else {
                            logger.log(ctx, 'WS GraphQL [#ANON]: ' + JSON.stringify(message.payload));
                        }
                    }

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
                            let errors: any[]|undefined;
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
            }, { server: server, path: '/api' });
        }

        // Starting server
        const httpServer = http.createServer(app);
        Server.applyMiddleware({ app, path: '/graphql' });
        Server.applyMiddleware({ app, path: '/api' });
        // Server.installSubscriptionHandlers(httpServer);
        httpServer.listen(dport);
        createWebSocketServer(httpServer);

    } else {
        await new Promise((resolver) => app.listen(0, () => resolver()));
    }

    return app;
}
