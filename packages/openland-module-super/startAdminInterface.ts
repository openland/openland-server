import * as bodyParser from 'body-parser';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import { graphqlExpress, graphiqlExpress } from 'apollo-server-express';
import { FDBGraphqlSchema } from 'openland-module-db/GraphEndpoint';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { execute, subscribe } from 'graphql';
import * as url from 'url';
import { Modules } from 'openland-modules/Modules';

export function startAdminInterface() {
    console.log('Starting Admin Interface...');

    const app = express();

    app.enable('trust proxy');

    // Basic Configuration
    app.use(cors());
    app.use(morgan('tiny'));
    app.use(compression());

    app.get('/', (req, res) => res.send('Welcome to Closedland API!'));
    app.get('/stats', async (req, res) => res.json(await Modules.Super.calculateStats()));

    let gqlMiddleware = graphqlExpress({ schema: FDBGraphqlSchema });
    app.use('/api', bodyParser.json({ limit: '5mb' }), gqlMiddleware);
    app.use('/sandbox', bodyParser.json({ limit: '5mb' }),
        graphiqlExpress((req) => ({
            endpointURL: '/api',
            subscriptionsEndpoint: url.format({
                host: req!!.get('host'),
                protocol: req!!.get('host') !== 'localhost' ? 'wss' : 'ws',
                pathname: '/api'
            })
        })));

    // Start listening

    new SubscriptionServer({
        schema: FDBGraphqlSchema,
        subscribe,
        execute,
        keepAlive: 10000
    }, { server: app.listen(8319), path: '/api' });
}