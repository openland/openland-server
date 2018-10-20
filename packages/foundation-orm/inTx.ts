import { FTransaction } from './FTransaction';
import { FDBError } from 'foundationdb';

export async function inTx<T>(callback: () => Promise<T>): Promise<T> {
    let ex = FTransaction.context.value;
    if (ex) {
        return callback();
    }

    let tx = new FTransaction();
    return await FTransaction.context.withContext(tx, async () => {
        // Implementation is copied from database.js from foundationdb library.
        do {
            try {
                const result = await callback();
                await tx.flush();
                return result;
            } catch (err) {
                if (err instanceof FDBError) {
                    await tx.tx!.rawOnError(err.code);
                    console.log('retry');
                } else {
                    throw err;
                }
            }
        } while (true);
    });
}