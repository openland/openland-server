import express from 'express';
import { createLogger } from '@openland/log';
import { createNamedContext } from '@openland/context';
const logger = createLogger('api-module');

export async function initHealthcheck() {
    let port = process.env.PORT;
    let dport = 9000;
    if (port !== undefined && port !== '') {
        dport = parseInt(process.env.PORT as string, 10);
    }

    const app = express();

    app.enable('trust proxy');

    // To avoid logging on this route
    app.get('/', (req, res) => res.status(200).send('Welcome to Openland API!'));
    app.get('/status', (req, res) => res.status(200).send('Welcome to Openland API!'));

    if (dport > 0) {
        logger.log(createNamedContext('api-module'), 'Binding to port ' + dport);

        return app.listen(dport);
    }
    return null;
}