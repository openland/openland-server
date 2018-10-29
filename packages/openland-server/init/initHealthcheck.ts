import express from 'express';

export async function initHealthcheck() {
    let port = process.env.PORT;
    let dport = 9000;
    if (port !== undefined && port !== '') {
        dport = parseInt(process.env.PORT as string, 10);
    }

    const app = express();

    app.enable('trust proxy');

    // To avoid logging on this route
    app.get('/', (req, res) => res.send('Welcome to Openland API!'));
    app.get('/status', (req, res) => res.send('Welcome to Openland API!'));

    if (dport > 0) {
        console.info('Binding to port ' + dport);

        app.listen(dport);
    }
}