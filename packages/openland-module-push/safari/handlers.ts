import { Express } from 'express';
import express from 'express';
import { Modules } from '../../openland-modules/Modules';
import { resolve } from 'path';
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';

let log = createLogger('safari-push');
let ctx = createNamedContext('safari-push');

export function initSafariPush(app: Express) {
    app.post('/push/safari/v1/log', handleLog);
    app.post('/push/safari/v2/log', handleLog);
    app.post('/push/safari/v2/devices/:deviceToken/registrations/:websitePushID', handleRegister);
    app.delete('/push/safari/v2/devices/:deviceToken/registrations/:websitePushID', handleDelete);
    app.post('/push/safari/v2/pushPackages/web.com.openland', handlePushPackage);
}

function handleLog(req: express.Request, response: express.Response) {
    log.warn(ctx, req.body);
}

function handleRegister(req: express.Request, response: express.Response) {
    if (req.params.websitePushID !== 'web.com.openland') {
        response.status(400).send();
        return;
    }
    // Registration should be handled on client side via registerPush()
    response.send('ok');
}

async function handleDelete(req: express.Request, response: express.Response) {
    if (req.params.websitePushID !== 'web.com.openland') {
        response.status(400).send();
        return;
    }
    await Modules.Push.disablePushSafari(ctx, req.params.deviceToken, 'web.com.openland');
    response.send('ok');
}

async function handlePushPackage(req: express.Request, response: express.Response) {
    response.setHeader('Content-type', 'application/zip');
    let path = resolve(__dirname + '/../../openland-server/assets/pushPackage.zip');
    response.sendFile(path);
}
