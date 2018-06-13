import * as express from 'express';
import { DB } from '../tables';
import { CallContext } from '../api/utils/CallContext';
import { Repos } from '../repositories';
import { IDs } from '../api/utils/IDs';
import { NotFoundError } from '../errors/NotFoundError';
import { ErrorText } from '../errors/ErrorText';
let domainCache = new Map<string, number | null>();

async function context(src: express.Request): Promise<CallContext> {

    let res = new CallContext();

    //
    // DEPRECATED: Resolving Account
    //
    let domain: string = 'sf';
    let accId = null;
    if (domainCache.has(domain)) {
        accId = domainCache.get(domain);
    } else {
        let acc = (await DB.Account.findOne({
            where: {
                slug: domain,
                activated: true
            }
        }));
        if (acc != null) {
            accId = acc.id!!;
        } else {
            accId = null;
        }
        if (!domainCache.has(domain)) {
            domainCache.set(domain, accId);
        }
    }
    if (accId == null) {
        throw new NotFoundError(ErrorText.unableToFindAccount(domain));
    }
    res.accountId = accId;

    //
    // Loading UID
    //
    if (src.user !== null && src.user !== undefined) {
        if (typeof src.user.sub === 'string') {
            res.uid = await Repos.Users.fetchUserByAuthId(src.user.sub);
        } else if (typeof src.user.id === 'number') {
            res.uid = src.user.id;
        }
    }

    //
    // Loading Organization
    //
    if (res.uid) {
        let accounts = await Repos.Users.fetchUserAccounts(res.uid);
        
        // Default behaviour: pick the default one
        if (accounts.length === 1) {
            res.oid = accounts[0];
        }

        // If there are organization cookie, try to use it instead
        let orgId = src.headers['x-openland-org'];
        if (orgId) {
            if (Array.isArray(orgId)) {
                orgId = orgId[0];
            }
            try {
                let porgId = IDs.Organization.parse(orgId as string);
                if (accounts.indexOf(porgId) >= 0) {
                    res.oid = porgId;
                }
            } catch (e) {
                console.warn(e);
            }
        }
    }

    return res;
}

export async function callContextMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    let ctx: CallContext;
    try {
        ctx = await context(req);
    } catch (e) {
        res!!.status(404).send('Unable to find domain');
        return;
    }
    if (ctx.uid) {
        console.log('GraphQL [#' + ctx.uid + ']: ' + JSON.stringify(req.body));
    } else {
        console.log('GraphQL [#ANON]: ' + JSON.stringify(req.body));
    }
    res.locals.ctx = ctx;
    next();
}