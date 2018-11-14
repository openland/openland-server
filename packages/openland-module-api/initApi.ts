import * as bodyParser from 'body-parser';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
// import compression from 'compression';
import * as Auth2 from '../openland-module-auth/authV2';
import * as Auth from '../openland-module-auth/providers/email';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { Schema } from './schema/Schema';
import { execute, subscribe, GraphQLSchema, DocumentNode, GraphQLFieldResolver } from 'graphql';
import { fetchWebSocketParameters, buildWebSocketContext } from './handlers/websocket';
import { errorHandler } from '../openland-errors';
// import { Rate } from '../utils/rateLimit';
import { Server as HttpServer } from 'http';
// import { delay } from '../utils/timer';
import { withAudit } from '../openland-module-auth/providers/email';
import { IDs } from './IDs';
import { withLogContext } from 'openland-log/withLogContext';
import { withTracingSpan } from 'openland-log/withTracing';
import { inTx } from 'foundation-orm/inTx';
import { Modules } from 'openland-modules/Modules';
import { schemaHandler } from './handlers/schema';
import { withCache } from 'foundation-orm/withCache';
import { createLogger } from 'openland-log/createLogger';

const logger = createLogger('ws');

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
    // API
    //
    let graphqlMiddleware = schemaHandler(isTest, !!engineKey);
    app.use('/api', Auth2.TokenChecker, bodyParser.json({ limit: '5mb' }), graphqlMiddleware);
    app.use('/graphql', Auth2.TokenChecker, bodyParser.json({ limit: '5mb' }), graphqlMiddleware);

    //
    // Authenticaton
    //
    app.post('/v2/auth', Auth2.JWTChecker, bodyParser.json(), Auth2.Authenticator);

    app.post('/auth/sendCode', bodyParser.json(), withAudit(Auth.sendCode));
    app.post('/auth/checkCode', bodyParser.json(), withAudit(Auth.checkCode));
    app.post('/auth/getAccessToken', bodyParser.json(), withAudit(Auth.getAccessToken));

    app.post('/semaphorebot', bodyParser.json(), (async (req, res) => {
        await inTx(async () => {
            let chatId = IDs.Conversation.parse('zoqLwdzr6VHelWZOR6JatW4aak');
            let botId = IDs.User.parse('vmM5pE5lQ4udYLr6AOLBhdQDJK');
            let data = req.body;

            if (data.result === 'passed') {
                let text = `${data.commit.author_name} ${data.event === 'deploy' ? 'deployed' : 'build'} :tada: - ${data.commit.message} to ${data.project_name}`;

                await Modules.Messaging.sendMessage(chatId, botId, { message: text });
            }
        });
    }));

    // Starting Api
    if (dport > 0) {
        console.info('Binding to port ' + dport);

        let formatError = (err: any) => {
            console.warn(err);
            return {
                ...errorHandler(err),
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
                    if (contextValue!.span!) {
                        try {
                            return await withCache(async () => {
                                return await withLogContext('ws', async () => {
                                    return await withTracingSpan(contextValue!.span!, async () => {
                                        return await execute(schema, document, rootValue, contextValue, variableValues, operationName, fieldResolver);
                                    });
                                });
                            });
                        } finally {
                            contextValue!.span!.finish();
                        }
                    } else {
                        return await withCache(async () => {
                            return await withLogContext('ws', async () => {
                                return await execute(schema, document, rootValue, contextValue, variableValues, operationName, fieldResolver);
                            });
                        });
                    }
                },
                subscribe,
                keepAlive: 10000,
                onConnect: async (args: any, webSocket: any) => {
                    webSocket.__params = await fetchWebSocketParameters(args, webSocket);
                },
                onOperation: async (message: any, params: any, webSocket: any) => {
                    if (!isTest) {
                        if (webSocket.__params.uid) {
                            logger.log('GraphQL [#' + webSocket.__params.uid + ']: ' + JSON.stringify(message.payload));
                        } else {
                            logger.log('WS GraphQL [#ANON]: ' + JSON.stringify(message.payload));
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
                        context: buildWebSocketContext(webSocket.__params),
                        formatResponse: (value: any) => ({
                            ...value,
                            errors: value.errors && value.errors.map(formatError),
                        })
                    };
                },
                validationRules: [
                    // disableIntrospection(undefined) // any introspection over WS is disabled
                ]
            }, { server: server, path: '/api' });
        }

        // Starting server
        createWebSocketServer(app.listen(dport));

    } else {
        await new Promise((resolver) => app.listen(0, () => resolver()));
    }

    return app;
}
