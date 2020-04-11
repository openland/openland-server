import { AppContext } from 'openland-modules/AppContext';
import { ConcurrencyPool, UnboundedConcurrencyPool, BoundedConcurrencyPoool } from 'openland-utils/ConcurrencyPool';

let pools = new Map<String, ConcurrencyPool>();

export function buildConcurrencyPool(ctx: AppContext): ConcurrencyPool {
    if (ctx.auth.tid) {
        let tid = ctx.auth.tid;
        if (!pools.has(tid)) {
            let res = new BoundedConcurrencyPoool(30);
            pools.set(tid, res);
            return res;
        }
        return pools.get(tid)!;
    } else {
        return UnboundedConcurrencyPool;
    }
}
