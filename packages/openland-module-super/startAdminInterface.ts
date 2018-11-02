// import * as bodyParser from 'body-parser';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';

export function startAdminInterface() {
    const app = express();

    app.enable('trust proxy');

    // Basic Configuration
    app.use(cors());
    app.use(morgan('tiny'));
    app.use(compression());

    // To avoid logging on this route
    app.get('/', (req, res) => res.send('Welcome to Closedland API!'));

    // Start listening
    app.listen(8319);
}