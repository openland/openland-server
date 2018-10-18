import { FTransaction } from './FTransaction';

export async function inTx<T>(callback: () => Promise<T>): Promise<T> {
    let ex = FTransaction.currentTransaction;
    if (ex) {
        return callback();
    }

    let tx = new FTransaction();
    FTransaction.currentTransaction = tx;
    try {
        let res = await callback();
        await tx.flush();
        return res;
    } finally {
        FTransaction.currentTransaction = null;
        await tx.abort();
    }
}