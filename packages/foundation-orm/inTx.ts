import { FTransaction } from './FTransaction';
import { FDBError } from 'foundationdb';
import { withLogContext } from 'openland-log/withLogContext';
import { createLogger } from 'openland-log/createLogger';
import { trace } from 'openland-log/trace';
import { tracer } from './utils/tracer';
const log = createLogger('tx');
export async function inTx<T>(callback: () => Promise<T>): Promise<T> {
    let ex = FTransaction.context.value;
    if (ex) {
        let res = await callback();
        await ex.flushPending(); // Flush all pending operations to avoid nasty bugs during compose
        return res;
    }

    let tx = new FTransaction();
    return await FTransaction.context.withContext(tx, async () => {
        return withLogContext(['transaction', tx.id.toString()], async () => {
            // Implementation is copied from database.js from foundationdb library.
            let isRetry = false;
            do {
                try {
                    tx.reset();
                    const result = await trace(tracer, isRetry ? 'tx-retry' : 'tx', async () => { return await callback(); });
                    await tx.flush();
                    return result;
                } catch (err) {
                    if (err instanceof FDBError) {
                        await tx.tx!.rawOnError(err.code);
                        log.debug('retry with code ' + err.code);
                        isRetry = true;
                    } else {
                        throw err;
                    }
                }
            } while (true);
        });
    });
}