import * as bodyParser from 'body-parser';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import * as Auth2 from '../handlers/authV2';
import * as Auth from '../handlers/auth';
import { schemaHandler } from '../handlers/schema';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { Schema } from '../api';
import { execute, subscribe } from 'graphql';
import { fetchWebSocketParameters, buildWebSocketContext } from '../handlers/websocket';
import { errorHandler } from '../errors';
import { Rate } from '../utils/rateLimit';
import { Server as HttpServer } from 'http';
import { ApolloEngine } from 'apollo-engine';
import { delay } from '../utils/timer';
import { DB } from '../tables';
import { withAudit } from '../handlers/auth';
import { Repos } from '../repositories';
import { IDs } from '../api/utils/IDs';

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

    // To avoid logging on this route
    app.get('/', (req, res) => res.send('Welcome to Openland API!'));
    app.get('/status', async (req, res) => {
        try  {
            let org = await DB.Organization.findById(1);
            console.log('db check', org ? org.id : null);
            res.send('Welcome to Openland API!');
        } catch (e) {
            console.log('db error');
            console.log(e);
            res.status(500).send(':(');
        }
    });
    app.get('/status', async (req, res) => {
        try  {
            let org = await DB.Organization.findById(1);
            console.log('db check', org ? org.id : null);
            res.send('Welcome to Openland API!');
        } catch (e) {
            console.log('db error');
            console.log(e);
            res.status(500).send(':(');
        }
    });
    app.get('/favicon.ico', (req, res) => res.send(404));

    // Basic Configuration
    if (!isTest) {
        app.use(cors());
        app.use(morgan('tiny'));
        app.use(compression());
    }

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
        await DB.txLight(async tx => {
            let chatId = IDs.Conversation.parse('Jlb4AOJBWEc5MvaQWkjLhlALo0');
            let botId = IDs.User.parse('vmM5pE5lQ4udYLr6AOLBhdQDJK');
            let data = req.body;

            if (data.result === 'passed' && data.event === 'deploy') {
                let text = `${data.commit.author_name} deployed - ${data.commit.message} to ${data.project_name}`;

                await Repos.Chats.sendMessage(tx, chatId, botId, { message: text });
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
                schema: Schema,
                execute,
                subscribe,
                keepAlive: 10000,
                onConnect: async (args: any, webSocket: any) => {
                    webSocket.__params = await fetchWebSocketParameters(args, webSocket);
                },
                onOperation: async (message: any, params: any, webSocket: any) => {
                    if (!isTest) {
                        if (webSocket.__params.uid) {
                            console.log('WS GraphQL [#' + webSocket.__params.uid + ']: ' + JSON.stringify(message.payload));
                        } else {
                            console.log('WS GraphQL [#ANON]: ' + JSON.stringify(message.payload));
                        }
                    }

                    let clientId = '';

                    if (webSocket.__params.uid) {
                        clientId = 'user_' + webSocket.__params.uid;
                    } else {
                        clientId = 'ip_' + webSocket._socket.remoteAddress;
                    }

                    let handleStatus = Rate.WS.canHandle(clientId);

                    if (!handleStatus.canHandle) {
                        if (handleStatus.delay) {
                            Rate.WS.hit(clientId);
                            await delay(handleStatus.delay);
                        } else {
                            throw new Error('Rate limit!');
                        }
                    } else {
                        Rate.WS.hit(clientId);
                    }

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

        if (engineKey) {
            // Starting server with Apollo Engine
            let server = new HttpServer(app);
            const engine = new ApolloEngine({
                apiKey: engineKey
            });
            engine.listen({
                port: dport,
                httpServer: server,
                graphqlPaths: ['/graphql', '/api']
            }, () => { createWebSocketServer(server); });
        } else {
            // Starting server
            createWebSocketServer(app.listen(dport));
        }

    } else {
        await new Promise((resolver) => app.listen(0, () => resolver()));
    }

    return app;
}
