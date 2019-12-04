import { Express } from 'express';
import express from 'express';
import { createLogger } from '@openland/log';
import { createNamedContext } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from '../openland-module-db/FDB';
import * as bodyParser from 'body-parser';
import { Modules } from '../openland-modules/Modules';
import { OauthScope } from './OauthModule';
import { IDs } from 'openland-module-api/IDs';

const log = createLogger('oauth');
const rootCtx = createNamedContext('oauth');

export const useOauth = (scope?: string) => async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    await inTx(rootCtx, async ctx => {
        if (!req.headers.authorization) {
            res.status(401).json({errors: [{message: 'Invalid auth'}]});
            return;
        }
        let [bearer, token] = req.headers.authorization.split(' ');
        if (bearer !== 'Bearer') {
            res.status(401).json({errors: [{message: 'Invalid auth'}]});
            return;
        }
        let authToken = await Store.OauthToken.salt.find(ctx, token);
        if (!authToken || !authToken.enabled) {
            res.status(401).json({errors: [{message: 'Invalid auth'}]});
            return;
        }
        if (scope && !authToken.scopes.includes(scope)) {
            res.status(401).json({errors: [{message: 'Invalid auth'}]});
            return;
        }

        (req as any).uid = authToken.uid;
        next();
    });
};
export function initOauth2(app: Express) {
    // tslint:disable-next-line:no-floating-promises
    initOauth2Internal(app);
}

async function initOauth2Internal(app: Express) {
    let projectUrl = (await Modules.Super.getEnvVar<string>(rootCtx, 'project-url')) || 'https://openland.com';

    app.get('/oauth2/authorize', async (req, res) => {
        await inTx(rootCtx, async ctx => {
            log.log(ctx, '/oauth2/authorize', req.query);
            if (
                !req.query ||
                !req.query.client_id ||
                !req.query.state ||
                typeof req.query.state !== 'string' ||
                req.query.state.trim().length === 0 ||
                !req.query.redirect_uri ||
                typeof req.query.redirect_uri !== 'string' ||
                req.query.redirect_uri.trim().length === 0 ||
                req.query.response_type !== 'code'
            ) {
                res.json({errors: [{message: 'Invalid params'}]});
                return;
            }
            let auth = await Modules.Oauth.createAuth(ctx, req.query.client_id, req.query.scope ? req.query.scope.split(',') : [], req.query.state, req.query.redirect_uri);
            res.redirect(`${projectUrl}/oauth/${auth.code}`);
        });
    });
    app.post('/oauth2/token', bodyParser.urlencoded(), async (req, res) => {
        await inTx(rootCtx, async ctx => {
            log.log(ctx, '/oauth2/token', req.body);
            let body = req.body;
            if (!body ||
                !body.client_id) {
                res.send(403);
                return;
            }
            let oapp = await Store.OauthApplication.findById(ctx, body.client_id);
            if (!oapp) {
                res.send(403);
                return;
            }

            if (
                !body.code ||
                body.client_secret !== oapp.clientSecret ||
                body.grant_type !== 'authorization_code'
            ) {
                log.log(ctx, 'invalid params');
                res.json({errors: [{message: 'Invalid params'}]});
                return;
            }
            let auth = await Store.OauthContext.fromCode.find(ctx, body.code);
            if (!auth || !auth.enabled || !auth.uid) {
                log.log(ctx, 'invalid code');
                res.json({errors: [{message: 'Invalid code'}]});
                return;
            }
            if (body.redirect_uri !== auth.redirectUrl) {
                log.log(ctx, 'invalid redirect_uri');
                res.json({errors: [{message: 'Invalid redirect_uri'}]});
                return;
            }
            auth.enabled = false;
            // console.log('lol', auth.scopes);
            let token = await Modules.Oauth.createToken(ctx, auth.clientId, auth.uid, auth.scopes as OauthScope[]);
            log.log(ctx, 'token granted');
            res.json({token_type: 'Bearer', access_token: token.salt});
        });
    });

    app.get('/ouath2/schema', useOauth(), async (req, res) => {
       res.json({
           uid: IDs.User.serialize((req as any).uid),
       });
    });
}