import { Concurrency } from './../openland-server/concurrency';
import { AppContext } from 'openland-modules/AppContext';
import { ConcurrencyPool } from 'openland-utils/ConcurrencyPool';

export function buildConcurrencyPool(ctx: AppContext): ConcurrencyPool {
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
