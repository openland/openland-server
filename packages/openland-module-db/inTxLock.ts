import { AsyncLock } from '../openland-utils/timer';
import { TransactionCache } from '@openland/foundationdb';
import { Context } from '@openland/context';

let cache = new TransactionCache<AsyncLock>('tx-lock-map');

export async function inTxLock<T>(ctx: Context, key: string, handler: () => Promise<T>): Promise<T> {
    let ex = cache.get(ctx, key);
    if (!ex) {
        ex = new AsyncLock();
        cache.set(ctx, key, ex);
    }
    return ex.inLock(handler);
}