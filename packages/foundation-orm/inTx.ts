import { FTransaction } from './FTransaction';
import { FDBError } from 'foundationdb';

export async function inTx<T>(callback: () => Promise<T>): Promise<T> {
    let ex = FTransaction.context.value;
    if (ex) {
        return callback();
    }

    let tx = new FTransaction();
    return await FTransaction.context.runAsync(async () => {
        await null; // Hack to fix contexts
        FTransaction.context.value = tx;

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
                        console.log('retry');
                    } else {
                        throw err;
                    }
                }
            } while (true);
        } finally {
            FTransaction.context.value = undefined;
        }
    });
}