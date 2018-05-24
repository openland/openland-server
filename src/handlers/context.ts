import { GraphQLOptions } from 'apollo-server-core';
import * as express from 'express';
import { DB } from '../tables';
import { CallContext } from '../api/CallContext';
import * as Schema from '../schema';
import { graphqlExpress } from 'apollo-server-express';
import * as Compose from 'compose-middleware';
import { Repos } from '../repositories';
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
        throw new Error('404: Unable to find account ' + domain);
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

    return res;
}

function handleRequest(useEngine: boolean) {
    return async function (req?: express.Request, res?: express.Response): Promise<GraphQLOptions> {
        if (req === undefined || res === undefined) {
            throw Error('Unexpected error!');
        } else {
            return { schema: Schema.Schema, context: res.locals.ctx, cacheControl: useEngine, tracing: useEngine };
        }
    };
}

async function buildContext(req: express.Request, res: express.Response, next: express.NextFunction) {
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

export function graphqlMiddleware(useEngine: boolean) {
    let gqlMiddleware = graphqlExpress(handleRequest(useEngine));
    return Compose.compose(buildContext as any, gqlMiddleware as any);
}