import { FTransactionReadWrite } from './tx/FTransactionReadWrite';
import { FDBError } from 'foundationdb';
import { withLogContext, withLogData } from 'openland-log/withLogContext';
import { currentTime } from 'openland-utils/timer';
import { Context } from '@openland/context';
import { FTransactionContext } from './utils/contexts';
import { tracer } from './utils/tracer';
import { randomGlobalInviteKey } from 'openland-utils/random';
import { createLogger } from '@openland/log';

const log = createLogger('fdb');

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
    let rtx = withLogData(ctx, { txid: randomGlobalInviteKey(8) });
    log.log(rtx, 'start tx');
    try {
        let isRetry = false;
        do {
            let tx = new FTransactionReadWrite();
            let ctxi = FTransactionContext.set(rtx, tx);
            ctxi = withLogContext(ctxi, ['transaction', tx.id.toString()]);
            try {
                const result = await tracer.trace(ctxi, isRetry ? 'tx-retry' : 'tx', async (ctx2) => await callback(ctx2));
                await tx.flush(ctxi);
                return result;
            } catch (err) {
                if (err instanceof FDBError) {
                    await tx.handleError(err.code);
                    log.log(withLogData(ctxi, { errorCode: err.code }), 'retry tx');
                    isRetry = true;
                } else {
                    throw err;
                }
            }
        } while (true);
    } finally {
        log.metric(rtx, 'tx time', (currentTime() - start), 'ms');
    }
}

export async function inTx<T>(ctx: Context, callback: (ctx: Context) => Promise<T>): Promise<T> {
    return doInTx(false, ctx, callback);
}

export async function inTxLeaky<T>(ctx: Context, callback: (ctx: Context) => Promise<T>): Promise<T> {
    return doInTx(true, ctx, callback);
}