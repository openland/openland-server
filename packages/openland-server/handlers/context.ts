import * as express from 'express';
import { CallContext } from '../api/utils/CallContext';
import { Repos } from '../repositories';
import { Modules } from 'openland-modules/Modules';

async function context(src: express.Request): Promise<CallContext> {
    let res = new CallContext();
    //
    // Loading UID
    //
    if (src.user !== null && src.user !== undefined) {
        if (typeof src.user.sub === 'string') {
            res.uid = await Repos.Users.fetchUserByAuthId(src.user.sub);
        } else if (typeof src.user.uid === 'number' && typeof src.user.tid === 'number') {
            res.uid = src.user.uid;
            res.tid = src.user.tid;
        }
    }

    res.ip = src.ip;

    //
    // Loading Organization
    //
    if (res.uid) {
        let accounts = await Repos.Users.fetchUserAccounts(res.uid);

        // Default behaviour: pick the default one
        if (accounts.length >= 1) {
            res.oid = accounts[0];

            let profile = await Modules.Users.profileById(res.uid);
            res.oid = (profile && profile.primaryOrganization) || res.oid;
        }

        // res.superRope = await Repos.Permissions.superRole(res.uid);
    }

    return res;
}

export async function callContextMiddleware(isTest: boolean, req: express.Request, res: express.Response, next: express.NextFunction) {
    let ctx: CallContext;
    try {
        ctx = await context(req);
    } catch (e) {
        res!!.status(404).send('Unable to find domain');
        return;
    }
    if (!isTest) {
        if (ctx.uid) {
            console.log('GraphQL [#' + ctx.uid + ']: ' + JSON.stringify(req.body));
        } else {
            console.log('GraphQL [#ANON]: ' + JSON.stringify(req.body));
        }
    }
    res.locals.ctx = ctx;
    next();
}