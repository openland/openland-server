import { TransactionCache } from '@openland/foundationdb';
import { Context } from '@openland/context';

let cache = new TransactionCache<any>('tx-cached-values');

export async function inTxCached<T>(ctx: Context, key: string, handler: () => Promise<T>): Promise<T> {
    let ex = cache.get(ctx, key);
    if (!ex) {
        ex = await handler();
        cache.set(ctx, key, ex);
    }
    return ex;
}