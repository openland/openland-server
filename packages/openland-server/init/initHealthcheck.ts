import express from 'express';
import { DB } from '../tables';

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
    app.get('/status', async (req, res) => {
        try {
            let org = await DB.Organization.findById(1);
            console.log('db check', org ? org.id : null);
            res.send('Welcome to Openland API!');
        } catch (e) {
            console.log('db error');
            console.log(e);
            res.status(500).send(':(');
        }
    });

    if (dport > 0) {
        console.info('Binding to port ' + dport);

        app.listen(dport);
    }
}