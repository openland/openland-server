import { FTransaction } from './FTransaction';
import { Context } from '@openland/context';
import { FTransactionContext, FTransactionReadOnlyContext } from './utils/contexts';
import { FTransactionReadOnly } from './tx/FTransactionReadOnly';
import { createLogger } from 'openland-log/createLogger';

const log = createLogger('fdb');
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
    if (!process.env.JEST_WORKER_ID) {
        log.warn(ctx, 'Using ephermal transaction! Consider using a permanent one.');
    }
    return new FTransactionReadOnly();
}