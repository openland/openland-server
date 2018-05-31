import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as cors from 'cors';
import * as morgan from 'morgan';
import { Engine } from 'apollo-engine';
import * as compression from 'compression';
import * as Auth1 from './handlers/authV1';
import * as Auth2 from './handlers/authV2';
import * as Context from './handlers/context';

export async function startApi() {

    console.info('Starting...');

    //
    // Fetching Port
    //
    let port = process.env.PORT;
    let dport = 9000;
    if (port !== undefined && port !== '') {
        dport = parseInt(process.env.PORT as string, 10);
    }

    //
    // Engine Integration
    //
    let engine: Engine | null = null;
    if (process.env.APOLLO_ENGINE) {
        engine = new Engine({
            engineConfig: {
                apiKey: process.env.APOLLO_ENGINE!!,
            },
            endpoint: '/api',
            graphqlPort: dport
        });
        engine.start();
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
    app.use(cors());
    app.use(morgan('tiny'));
    app.use(compression());
    if (engine != null) {
        app.use(engine.expressMiddleware());
    }

    //
    // API
    //
    let graphqlMiddleware = Context.graphqlMiddleware(engine != null);
    app.use('/api', Auth1.JWTChecker, Auth2.TokenChecker, bodyParser.json({ limit: '5mb' }), graphqlMiddleware);
    app.use('/graphql', Auth1.JWTChecker, Auth2.TokenChecker, bodyParser.json({ limit: '5mb' }), graphqlMiddleware);

    //
    // Authenticaton
    //
    app.post('/auth', Auth1.JWTChecker, bodyParser.json(), Auth1.Authenticator);
    app.post('/v2/auth', Auth2.JWTChecker, bodyParser.json(), Auth2.Authenticator);

    // Starting Api
    console.info('Binding to port ' + dport);
    app.listen(dport);
}
