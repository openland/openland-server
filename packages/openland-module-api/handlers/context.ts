import * as express from 'express';
import { Modules } from 'openland-modules/Modules';
import { createTracer } from 'openland-log/createTracer';
import { AuthContext } from 'openland-module-auth/AuthContext';
import { TracingContext } from 'openland-log/src/TracingContext';
import { CacheContext } from 'openland-module-api/CacheContext';
import { AppContext } from 'openland-modules/AppContext';
import { createNamedContext } from '@openland/context';
import { randomGlobalInviteKey } from 'openland-utils/random';
import { createLogger, withLogMeta } from '@openland/log';
import { withReadOnlyTransaction, inTx } from '@openland/foundationdb';
import { withGqlTrace } from '../../openland-graphql/gqlTracer';
import { RequestContext } from '../RequestContext';

let tracer = createTracer('express');
const logger = createLogger('http');

let rootContext = createNamedContext('http');

async function context(src: express.Request): Promise<AppContext> {

    return await inTx(rootContext, async (ctx) => {
        let res = rootContext;
        let uid: number | undefined;
        let tid: string | undefined;
        let oid: number | undefined;

        let latLong = src.header('X-Client-Geo-LatLong')?.split(', ').map(a => parseInt(a, 10));
        res = RequestContext.set(res, {
            ip: src.header('X-Forwarded-For')?.split(', ')[0] || src.connection.remoteAddress,
            latLong: latLong ? {
                lat: latLong[0],
                long: latLong[1]
            } : undefined,
        });

        // User
        if ((src as any).user !== null && (src as any).user !== undefined) {
            if (typeof (src as any).user.sub === 'string') {
                uid = await Modules.Users.findUserByAuthId(ctx, (src as any).user.sub);
                tid = (src as any).user.sub;
            } else if (typeof (src as any).user.uid === 'number' && typeof (src as any).user.tid === 'string') {
                uid = (src as any).user.uid;
                tid = (src as any).user.tid;
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
        res = withGqlTrace(res, 'http');

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