import { FTransaction } from './FTransaction';
import { FDBError } from 'foundationdb';
import { withLogContext } from 'openland-log/withLogContext';
import { createLogger } from 'openland-log/createLogger';
import { currentTime } from 'openland-utils/timer';
import { Context } from 'openland-utils/Context';
import { FTransactionContext } from './utils/contexts';
import { tracer } from './utils/tracer';

const log = createLogger('tx', false);

async function doInTx<T>(leaky: boolean, ctx: Context, callback: (ctx: Context) => Promise<T>): Promise<T> {
    let ex = FTransactionContext.get(ctx);
    if (ex) {
        if (!leaky) {
             // Flush all pending operations to avoid nasty bugs during compose
            await tracer.trace(ctx, 'pre-sub-tx-flush', async (ctx2) => await ex!.flushPending(ctx2));
        }
        let res = await tracer.trace(ctx, 'sub-tx', async (ctx2) => await callback(ctx2));
        if (!leaky) {
            // Flush all pending operations to avoid nasty bugs during compose
            await tracer.trace(ctx, 'post-sub-tx-flush', async (ctx2) => await ex!.flushPending(ctx2));
        }
        return res;
    }

    let start = currentTime();
    // Implementation is copied from database.js from foundationdb library.
    try {
        let isRetry = false;
        do {
            let tx = new FTransaction();
            let ctxi = FTransactionContext.set(ctx, tx);
            ctxi = withLogContext(ctxi, ['transaction', tx.id.toString()]);
            try {
                const result = await tracer.trace(ctxi, isRetry ? 'tx-retry' : 'tx', async (ctx2) => await callback(ctx2));
                await tx.flush(ctxi);
                return result;
            } catch (err) {
                if (err instanceof FDBError) {
                    await tx.tx!.rawOnError(err.code);
                    log.debug(ctxi, 'retry with code ' + err.code);
                    isRetry = true;
                } else {
                    throw err;
                }
            }
        } while (true);
    } finally {
        log.debug(ctx, 'full tx time: ' + (currentTime() - start) + ' ms');
    }
}

export async function inTx<T>(ctx: Context, callback: (ctx: Context) => Promise<T>): Promise<T> {
    return doInTx(false, ctx, callback);
}

export async function inTxLeaky<T>(ctx: Context, callback: (ctx: Context) => Promise<T>): Promise<T> {
    return doInTx(true, ctx, callback);
}