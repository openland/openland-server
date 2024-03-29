import { Config } from 'openland-config/Config';
import * as bodyParser from 'body-parser';
import express from 'express';
import cors from 'cors';
// import morgan from 'morgan';
import * as Auth2 from '../openland-module-auth/authV2';
import * as Auth from '../openland-module-auth/providers/email';
import * as AuthGoogle from '../openland-module-auth/providers/google';
import { Schema } from './schema/Schema';
import { fetchWebSocketParameters, buildWebSocketContext } from './handlers/websocket';
import { errorHandler, QueryInfo } from '../openland-errors';
import { withAudit } from '../openland-module-auth/providers/email';
import { IDs } from './IDs';
import { Modules } from 'openland-modules/Modules';
import { initSafariPush } from '../openland-module-push/safari/handlers';
import { initAppHandlers } from '../openland-module-apps/Apps.handler';
import { ApolloServer } from 'apollo-server-express';
import { callContextMiddleware } from './handlers/context';
import * as http from 'http';
import { TokenChecker } from '../openland-module-auth/authV2';
import { parseCookies } from '../openland-utils/parseCookies';
import { decode } from 'openland-utils/base64';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import * as url from 'url';
import { createNamedContext } from '@openland/context';
import { createLogger, withLogPath } from '@openland/log';
import { inHybridTx, inTx } from '@openland/foundationdb';
import { uuid } from '../openland-utils/uuid';
import { withLifetime } from '@openland/lifetime';
import { initZapier } from '../openland-module-zapier/http.handlers';
import { initOauth2 } from '../openland-module-oauth/http.handlers';
import { AuthContext } from '../openland-module-auth/AuthContext';
import { initPhoneAuthProvider } from '../openland-module-auth/providers/phone';
import { Shutdown } from '../openland-utils/Shutdown';
import { createSpaceXServer } from '../openland-spacex/spaceXServer';
import { execute } from './execute';

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
    app.get('/', (req, res) => res.status(200).send('Welcome to Openland API!'));
    app.get('/status', (req, res) => res.status(200).send('Welcome to Openland API!'));
    app.get('/favicon.ico', (req, res) => res.sendStatus(404));
    app.get('/robots.txt', (req, res) => res.sendStatus(404));

    //
    // Authenticaton
    //
    app.post('/v2/auth', Auth2.JWTChecker, bodyParser.json(), Auth2.Authenticator);

    app.post('/auth/sendCode', bodyParser.json(), withAudit(Auth.sendCode));
    app.post('/auth/checkCode', bodyParser.json(), withAudit(Auth.checkCode));
    app.post('/auth/getAccessToken', bodyParser.json(), withAudit(Auth.getAccessToken));
    app.post('/auth/google/getAccessToken', bodyParser.json(), withAudit(AuthGoogle.getAccessToken));

    initPhoneAuthProvider(app);

    //
    //  Safari push
    //
    initSafariPush(app);

    //
    //  Apps
    //
    initAppHandlers(app);

    // IFTTT api
    // initIFTTT(app);

    // Zapier api
    initZapier(app);

    // Ouath2 api
    initOauth2(app);

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

    // NOTE: Create separate since apollo hacks it
    const ApolloSchema = Schema();
    const Server = new ApolloServer({
        schema: ApolloSchema,
        introspection: true,
        tracing: Config.environment !== 'production',
        executor: async (requestContext) => {
            let isMutation = requestContext.document.definitions[0].kind === 'OperationDefinition' && requestContext.document.definitions[0].operation === 'mutation';
            return await (isMutation ? inTx : inHybridTx)(requestContext.context as any, async (ctx) => {
                return await execute(ctx, {
                    schema: ApolloSchema,
                    document: requestContext.document,
                    contextValue: ctx
                });
            }) as any;
        },
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
                return buildWebSocketContext(
                    wsctx || {},
                    context.req.header('X-Forwarded-For'),
                    context.req.header('X-Client-Geo-LatLong'),
                    context.req.header('X-Client-Geo-Location')
                );
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

    let server: http.Server;
    // Starting Api
    if (dport > 0) {
        logger.log(rootCtx, 'Binding to port ' + dport);

        // Starting server
        const httpServer = http.createServer(app);

        Server.applyMiddleware({ app, path: '/graphql' });
        Server.applyMiddleware({ app, path: '/api' });

        // const wsCtx = createNamedContext('ws-gql');
        let spacex = await createSpaceXServer({
            executableSchema: Modules.API.schema,
            queryCache: Modules.API.queryCache,
            onAuth: async (params, req) => {
                // const start = currentRunningTime();
                try {
                    if (!params || Object.keys(params).length === 0 && req.headers.cookie && req.headers.cookie.length > 0) {
                        let cookies = parseCookies(req.headers.cookie || '');
                        return await fetchWebSocketParameters({ 'x-openland-token': cookies['x-openland-token'] }, null);
                    }
                    return await fetchWebSocketParameters(params, null);
                } finally {
                    // const delta = currentRunningTime() - start;
                    // authMetric.add(authMetricCtx, delta);
                }
            },
            context: async (params, operation, req) => {
                let opId = uuid();
                let ctx = buildWebSocketContext(
                    params || {},
                    req.headers['x-forwarded-for'] as string,
                    req.headers['x-client-geo-latlong'] as string,
                    req.headers['x-client-geo-location'] as string
                );
                ctx = withLogPath(ctx, `query ${opId} ${operation.name || ''}`);
                // return withConcurrentcyPool(ctx, buildConcurrencyPool(ctx));
                return ctx;
            },
            subscriptionContext: async (params, operation, req) => {
                // let opId = firstCtx ? GqlQueryIdNamespace.get(firstCtx)! : uuid();
                let ctx = buildWebSocketContext(
                    params || {},
                    req.headers['x-forwarded-for'] as string,
                    req.headers['x-client-geo-latlong'] as string,
                    req.headers['x-client-geo-location'] as string,
                );
                ctx = withLogPath(ctx, `subscription ${operation.name || ''}`);
                ctx = withLifetime(ctx);
                return ctx;
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
            onOperationFinish: (ctx, operation, duration) => {
                // let trace = gqlTraceNamespace.get(ctx);
                // if (trace) {
                //     trace.onRequestFinish();
                //     await saveTrace(trace.getTrace());
                // }
            },
            onEventResolveFinish: async (ctx, operation, duration) => {
                // Nothing to do
            },
            formatResponse: (value, operation, ctx) => {

                // Log error
                let auth = AuthContext.get(ctx);
                let uid = auth.uid;
                let queryInfo: QueryInfo = {
                    uid,
                    transport: 'ws',
                    query: JSON.stringify(operation)
                };
                if (value.errors) {
                    for (let err of value.errors) {
                        logger.warn(rootCtx, 'api_error', err, queryInfo);
                    }
                }

                // SpaceX formatted errors internally
                return value;
            }
        });

        httpServer.on('upgrade', (request, socket, head) => {
            const pathname = url.parse(request.url).pathname;

            if (pathname === '/api') {
                spacex.ws.handleUpgrade(request, socket, head, (_ws) => {
                    spacex.ws.emit('connection', _ws, request);
                });
            } else if (pathname === '/gql_ws') {
                spacex.ws.handleUpgrade(request, socket, head, (_ws) => {
                    spacex.ws.emit('connection', _ws, request);
                });
            } else {
                socket.destroy();
            }
        });
        httpServer.listen(dport);
        Shutdown.registerWork({
            name: 'http-server',
            shutdown: async () => {
                httpServer.close();
            }
        });
        server = httpServer;
    } else {
        server = app.listen(0);
    }

    return server;
}
