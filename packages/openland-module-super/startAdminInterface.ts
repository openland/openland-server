import * as bodyParser from 'body-parser';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import { graphqlExpress, graphiqlExpress } from 'apollo-server-express';
import { FDBGraphqlSchema } from 'openland-module-db/GraphEndpoint';

export function startAdminInterface() {
    console.log('Starting Admin Interface...');

    const app = express();

    app.enable('trust proxy');

    // Basic Configuration
    app.use(cors());
    app.use(morgan('tiny'));
    app.use(compression());

    app.get('/', (req, res) => res.send('Welcome to Closedland API!'));

    let gqlMiddleware = graphqlExpress({ schema: FDBGraphqlSchema });
    app.use('/api', bodyParser.json({ limit: '5mb' }), gqlMiddleware);
    app.use('/sandbox', bodyParser.json({ limit: '5mb' }), graphiqlExpress({ endpointURL: '/api' }));

    // Start listening
    app.listen(8319);
}