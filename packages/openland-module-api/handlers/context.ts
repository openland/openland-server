import * as express from 'express';
import { Modules } from 'openland-modules/Modules';
import { createTracer } from 'openland-log/createTracer';
import { AuthContext } from 'openland-module-auth/AuthContext';
import { TracingContext } from 'openland-log/src/TracingContext';
import { CacheContext } from 'openland-module-api/CacheContext';
import { AppContext } from 'openland-modules/AppContext';
import { withReadOnlyTransaction } from 'foundation-orm/withReadOnlyTransaction';
import { createNamedContext } from '@openland/context';
import { inTx } from 'foundation-orm/inTx';
import { randomGlobalInviteKey } from 'openland-utils/random';
import { createLogger, withLogMeta } from '@openland/log';

let tracer = createTracer('express');
const logger = createLogger('http');

let rootContext = createNamedContext('http');

async function context(src: express.Request): Promise<AppContext> {

    return await inTx(rootContext, async (ctx) => {
        let res = rootContext;
        let uid: number | undefined;
        let tid: string | undefined;
        let oid: number | undefined;

        // User
        if (src.user !== null && src.user !== undefined) {
            if (typeof src.user.sub === 'string') {
                uid = await Modules.Users.findUserByAuthId(ctx, src.user.sub);
                tid = src.user.sub;
            } else if (typeof src.user.uid === 'number' && typeof src.user.tid === 'string') {
                uid = src.user.uid;
                tid = src.user.tid;
            }
        }
        // Organization
        if (uid) {
            let accounts = await Modules.Orgs.findUserOrganizations(ctx, uid);

            // Default behaviour: pick the default one
            if (accounts.length >= 1) {
                oid = accounts[0];

                let profile = await Modules.Users.profileById(ctx, uid);
                oid = (profile && profile.primaryOrganization) || oid;
            }
        }

        // Auth Context
        res = AuthContext.set(res, { tid, uid, oid });
        if (uid && tid) {
            ctx = withLogMeta(ctx, { uid: uid, tid: tid });
        }

        // Tracing Context
        res = TracingContext.set(res, { span: tracer.startSpan('http') });
        res = CacheContext.set(res, new Map());
        res = withReadOnlyTransaction(res);
        res = withLogMeta(res, { connection: randomGlobalInviteKey(8) });

        return new AppContext(res);
    });
}

export async function callContextMiddleware(isTest: boolean, req: express.Request, res: express.Response) {
    let ctx: AppContext;
    try {
        ctx = await context(req);
    } catch (e) {
        res!!.status(404).send('Unable to find domain');
        return;
    }
    if (!isTest) {
        if (AuthContext.get(ctx).uid) {
            logger.log(ctx, 'GraphQL [#' + AuthContext.get(ctx).uid + ']: ' + JSON.stringify(req.body));
        } else {
            logger.log(ctx, 'GraphQL [#ANON]: ' + JSON.stringify(req.body));
        }
    }
    res.locals.ctx = ctx;

    const originalEnd = res.end;
    res.end = function (...args: any[]) {
        res.end = originalEnd;
        const returned = (res.end as any).call(this, ...args);
        let span = TracingContext.get(ctx).span;
        if (span) {
            span.finish();
        }
        return returned;
    };
}