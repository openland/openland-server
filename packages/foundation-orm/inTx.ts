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
        return callback();
    }

    let tx = new FTransaction();
    return await FTransaction.context.withContext(tx, async () => {
        return withLogContext(['transaction', tx.id.toString()], async () => {
            // Implementation is copied from database.js from foundationdb library.
            do {
                try {
                    const result = await trace(tracer, 'tx', async () => { return await callback(); });
                    await tx.flush();
                    return result;
                } catch (err) {
                    if (err instanceof FDBError) {
                        await tx.tx!.rawOnError(err.code);
                        log.debug('retry with code ' + err.code);
                    } else {
                        throw err;
                    }
                }
            } while (true);
        });
    });
}