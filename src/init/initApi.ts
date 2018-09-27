import * as bodyParser from 'body-parser';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import * as Auth2 from '../handlers/authV2';
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
import { randomString } from '../utils/random';
import { Emails } from '../services/Emails';
import * as base64 from '../utils/base64';
import { randomBytes } from 'crypto';
import { Repos } from '../repositories';

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

    app.post('/auth/sendCode', bodyParser.json(), async (req: express.Request, response: express.Response) => {
        let {
            email,
            phone
        } = req.body;

        if (!email && !phone) {
            response.json({ ok: false });
            return;
        }

        let code = randomString(7);

        if (email) {
            await Emails.sendDebugEmail(email, 'Your code: ' + code);

            let session = await DB.AuthSession.create({
                sessionSalt: base64.encodeBuffer(randomBytes(64)),
                code,
                codeExpires: new Date(Date.now() + 1000 * 60 * 5 ), // 5 minutes
                extras: {
                    email
                }
            });

            response.json({ ok: true, session: session.sessionSalt });
        } else if (phone) {
            console.log(phone);
            response.json({ ok: false });
        }
    });
    app.post('/auth/checkCode', bodyParser.json(), async (req: express.Request, response: express.Response) => {
        let {
            session,
            code
        } = req.body;

        if (!session && !code) {
            response.json({ ok: false });
            return;
        }

        let authSession = await DB.AuthSession.findOne({ where: { sessionSalt: session } });

        // No session found
        if (!authSession) {
            response.json({ ok: false });
            return;
        }

        // Code expired
        if (new Date() > authSession.codeExpires! ) {
            response.json({ ok: false });
            return;
        }

        // Wrong code
        if (authSession.code! !== code) {
            response.json({ ok: false });
            return;
        }

        authSession.extras!.authToken = base64.encodeBuffer(randomBytes(64));
        (authSession as any).changed('extras', true);
        await authSession.save();

        response.json({ ok: true, authToken: authSession.extras!.authToken });
    });
    app.post('/auth/getAccessToken', bodyParser.json(), async (req: express.Request, response: express.Response) => {
        let {
            session,
            authToken
        } = req.body;

        if (!session && !authToken) {
            response.json({ ok: false });
            return;
        }

        let authSession = await DB.AuthSession.findOne({ where: { sessionSalt: session, extras: { authToken } } });

        // No session found
        if (!authSession) {
            response.json({ ok: false });
            return;
        }

        if (authSession.extras!.email) {
            let existing = await DB.User.findOne({ where: { email: authSession.extras!.email as any } });

            if (existing) {
                let token = await Repos.Tokens.createToken(existing.id!);
                response.json({ ok: true, accessToken: token });
                await authSession.destroy();
                return;
            } else {
                let user = await DB.User.create({
                    authId: 'email|' + authSession.extras!.email,
                    email: '',
                });
                let token = await Repos.Tokens.createToken(user.id!);
                response.json({ ok: true, accessToken: token });
                await authSession.destroy();
                return;
            }
        } else {
            response.json({ ok: false });
        }
    });

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
                }
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
