import { Concurrency } from './../openland-server/concurrency';
import { ConcurrencyPool } from 'openland-utils/ConcurrencyPool';
import { Context } from '@openland/context';

export function buildConcurrencyPool(ctx: Context): ConcurrencyPool {
    if (ctx.auth.tid) {
        let tid = ctx.auth.tid;
        return Concurrency.FDB.get('tid:' + tid);
    } else {
        if (ctx.req.ip) {
            return Concurrency.FDB.get('ip:' + ctx.req.ip!);
        } else {
            return Concurrency.Default;
        }
    }
}
