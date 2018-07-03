import * as bodyParser from 'body-parser';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import * as Auth2 from '../handlers/authV2';
import { schemaHandler } from '../handlers/schema';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { Schema } from '../api/index';
import { execute, subscribe } from 'graphql';
import { fetchWebSocketParameters, buildWebSocketContext } from '../handlers/websocket';
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

    //
    // Middlewares
    //

    const app = express();

    // To avoid logging on this route
    app.get('/', (req, res) => res.send('Welcome to Openland API!'));
    app.get('/status', (req, res) => res.send('Welcome to Openland API!'));
    app.get('/healthz', (req, res) => res.send('Welcome to Openland API!'));
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
    let graphqlMiddleware = schemaHandler(isTest);
    app.use('/api', Auth2.TokenChecker, bodyParser.json({ limit: '5mb' }), graphqlMiddleware);
    app.use('/graphql', Auth2.TokenChecker, bodyParser.json({ limit: '5mb' }), graphqlMiddleware);

    //
    // Authenticaton
    //
    app.post('/v2/auth', Auth2.JWTChecker, bodyParser.json(), Auth2.Authenticator);

    // Starting Api
    if (dport > 0) {
        console.info('Binding to port ' + dport);
        let listener = app.listen(dport);

        // Starting WS
        new SubscriptionServer({
            schema: Schema,
            execute,
            subscribe,
            onConnect: async (args: any, webSocket: any) => {
                console.warn(args);
                webSocket.__params = await fetchWebSocketParameters(args, webSocket);
            },
            onOperation: (message: any, params: any, webSocket: any) => {
                if (!isTest) {
                    if (webSocket.__params.uid) {
                        console.log('WS GraphQL [#' + webSocket.__params.uid + ']: ' + JSON.stringify(message.payload));
                    } else {
                        console.log('WS GraphQL [#ANON]: ' + JSON.stringify(message.payload));
                    }
                }
                return { ...params, context:  buildWebSocketContext(webSocket.__params) };
            }
        }, { server: listener, path: '/api' });
    } else {
        await new Promise((resolver) => app.listen(0, () => resolver()));
    }

    return app;
}
