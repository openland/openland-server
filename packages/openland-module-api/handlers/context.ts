import * as express from 'express';
import { Modules } from 'openland-modules/Modules';
import { createTracer } from 'openland-log/createTracer';
import { createLogger } from 'openland-log/createLogger';
import { createEmptyContext } from 'openland-utils/Context';
import { AuthContext } from 'openland-module-auth/AuthContext';
import { TracingContext } from 'openland-log/TracingContext';
import { CacheContext } from 'openland-module-api/CacheContext';
import { AppContext } from 'openland-modules/AppContext';

let tracer = createTracer('express');
const logger = createLogger('http');

async function context(src: express.Request): Promise<AppContext> {

    let res = createEmptyContext();
    let uid: number | undefined;
    let tid: string | undefined;
    let oid: number | undefined;

    // User
    if (src.user !== null && src.user !== undefined) {
        if (typeof src.user.sub === 'string') {
            uid = await Modules.Users.findUserByAuthId(createEmptyContext(), src.user.sub);
        } else if (typeof src.user.uid === 'number' && typeof src.user.tid === 'number') {
            uid = src.user.uid;
            tid = src.user.tid;
        }
    }
    // Organization
    if (uid) {
        let accounts = await Modules.Orgs.findUserOrganizations(createEmptyContext(), uid);

        // Default behaviour: pick the default one
        if (accounts.length >= 1) {
            oid = accounts[0];

            let profile = await Modules.Users.profileById(createEmptyContext(), uid);
            oid = (profile && profile.primaryOrganization) || oid;
        }
    }

    // Auth Context
    res = AuthContext.set(res, { tid, uid, oid });

    // Tracing Context
    res = TracingContext.set(res, { span: tracer.startSpan('http') });
    res = CacheContext.set(res, new Map());
    return new AppContext(res);
}

export async function callContextMiddleware(isTest: boolean, req: express.Request, res: express.Response, next: express.NextFunction) {
    let ctx: AppContext;
    try {
        ctx = await context(req);
    } catch (e) {
        res!!.status(404).send('Unable to find domain');
        return;
    }
    if (!isTest) {
        if (AuthContext.get(ctx).uid) {
            logger.log('GraphQL [#' + AuthContext.get(ctx).uid + ']: ' + JSON.stringify(req.body));
        } else {
            logger.log('GraphQL [#ANON]: ' + JSON.stringify(req.body));
        }
    }
    res.locals.ctx = ctx;

    const originalEnd = res.end;
    res.end = function (...args: any[]) {
        res.end = originalEnd;
        const returned = res.end.call(this, ...args);
        let span = TracingContext.get(ctx).span;
        if (span) {
            span.finish();
        }
        return returned;
    };

    next();
}