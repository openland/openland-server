import { FTransaction } from './FTransaction';
import { Context } from 'openland-utils/Context';
import { FTransactionContext, FTransactionReadOnlyContext } from './utils/contexts';
import { FTransactionReadOnly } from './FTransactionReadOnly';

export function getTransaction(ctx: Context): FTransaction {
    let tx = FTransactionContext.get(ctx);
    if (tx) {
        return tx;
    }
    let cache = FTransactionReadOnlyContext.get(ctx);
    if (cache) {
        return cache;
    }

    // Create ephermal read-only transaction
    return new FTransactionReadOnly();
}