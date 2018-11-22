import { Express } from 'express';
import express from 'express';
import { createLogger } from '../../openland-log/createLogger';
import { createEmptyContext } from '../../openland-utils/Context';

let log = createLogger('safari push');
let ctx = createEmptyContext();

export function initSafariPush(app: Express) {
    app.post('/push/safari/v2/log', handleLog);
    app.post('/push/safari/v2/devices/:deviceToken/registrations/:websitePushID', handleRegister);
    app.delete('/push/safari/v2/devices/:deviceToken/registrations/:websitePushID', handleDelete);
}

function handleLog(req: express.Request, response: express.Response) {
    log.warn(ctx, req.body);
}

function handleRegister(req: express.Request, response: express.Response) {
    if (req.params.websitePushID !== 'web.com.openland') {
        response.status(400).send();
        return;
    }
}

function handleDelete(req: express.Request, response: express.Response) {
    if (req.params.websitePushID !== 'web.com.openland') {
        response.status(400).send();
        return;
    }
}