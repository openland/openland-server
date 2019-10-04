import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import { ApolloServer } from 'apollo-server-express';
import { Modules } from 'openland-modules/Modules';
import * as http from 'http';
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { createGraphQLAdminSchema } from 'openland-module-db/tools/GraphEndpoint';
import { Shutdown } from '../openland-utils/Shutdown';

const rootCtx = createNamedContext('admin');
const logger = createLogger('admin');

export async function startAdminInterface() {
    logger.log(rootCtx, 'Starting Admin Interface...');

    const app = express();

    app.enable('trust proxy');

    // Basic Configuration
    app.use(cors());
    app.use(morgan('tiny'));
    app.use(compression());

    app.get('/', (req, res) => res.send('Welcome to Closedland API!'));
    app.get('/stats', async (req, res) => res.json(await Modules.Super.calculateStats(rootCtx)));

    const Server = new ApolloServer({
        schema: await createGraphQLAdminSchema(),
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

    Shutdown.registerWork({
        name: 'admin-gql',
        shutdown: async (ctx) => {
            await new Promise(resolve => {
                httpServer.close(() => resolve());
            });
        }
    });
}