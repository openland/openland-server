import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import { ApolloServer } from 'apollo-server-express';
import { FDBGraphqlSchema } from 'openland-module-db/tools/GraphEndpoint';
import { Modules } from 'openland-modules/Modules';
import { createEmptyContext } from 'openland-utils/Context';
import * as http from 'http';

export function startAdminInterface() {
    console.log('Starting Admin Interface...');

    const app = express();

    app.enable('trust proxy');

    // Basic Configuration
    app.use(cors());
    app.use(morgan('tiny'));
    app.use(compression());

    app.get('/', (req, res) => res.send('Welcome to Closedland API!'));
    app.get('/stats', async (req, res) => res.json(await Modules.Super.calculateStats(createEmptyContext())));

    const Server = new ApolloServer({
        schema: FDBGraphqlSchema,
        introspection: true,
        playground: {
            endpoint: 'https://db.openland.io/graphql',
            settings: {
                'request.credentials': 'include'
            } as any
        }
    });

    const httpServer = http.createServer(app);
    Server.applyMiddleware({ app, path: '/graphql' });
    Server.applyMiddleware({ app, path: '/api' });
    Server.installSubscriptionHandlers(httpServer);
    httpServer.listen(8319);
}