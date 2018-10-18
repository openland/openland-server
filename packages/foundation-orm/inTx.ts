import { FTransaction } from './FTransaction';
import { FDBError } from 'foundationdb';

export async function inTx<T>(callback: () => Promise<T>): Promise<T> {
    let ex = FTransaction.currentTransaction;
    if (ex) {
        return callback();
    }

    let tx = new FTransaction();
    FTransaction.currentTransaction = tx;
    // Implementation is copied from database.js from foundationdb library.
    try {
        do {
            try {
                const result = await callback();
                await tx.flush();
                return result;
            } catch (err) {
                if (err instanceof FDBError) {
                    await tx.tx!.rawOnError(err.code);
                } else {
                    throw err;
                }
            }
        } while (true);
    } finally {
        FTransaction.currentTransaction = null;
    }
}