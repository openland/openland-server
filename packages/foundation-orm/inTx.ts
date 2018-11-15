import { FTransaction } from './FTransaction';
import { FDBError } from 'foundationdb';
import { withLogContext } from 'openland-log/withLogContext';
import { createLogger } from 'openland-log/createLogger';
import { currentTime } from 'openland-utils/timer';
import { Context } from 'openland-utils/Context';
import { FTransactionContext } from './utils/contexts';

const log = createLogger('tx');

export async function inTx<T>(ctx: Context, callback: (ctx: Context) => Promise<T>): Promise<T> {
    let ex = FTransactionContext.get(ctx);
    if (ex) {
        let res = await callback(ctx);
        await ex.flushPending(ctx); // Flush all pending operations to avoid nasty bugs during compose
        return res;
    }

    let tx = new FTransaction();
    let start = currentTime();
    ctx = FTransactionContext.set(ctx, tx);
    ctx = withLogContext(ctx, ['transaction', tx.id.toString()]);

    // Implementation is copied from database.js from foundationdb library.
    try {
        // let isRetry = false;
        do {
            try {
                tx.reset();
                const result = await callback(ctx); // await trace(tracer, isRetry ? 'tx-retry' : 'tx', async () => { return await callback(ctx); });
                await tx.flush(ctx);
                return result;
            } catch (err) {
                if (err instanceof FDBError) {
                    await tx.tx!.rawOnError(err.code);
                    log.debug(ctx, 'retry with code ' + err.code);
                    // isRetry = true;
                } else {
                    throw err;
                }
            }
        } while (true);
    } finally {
        log.debug(ctx, 'full tx time: ' + (currentTime() - start) + ' ms');
    }
}