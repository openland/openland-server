import { createContextNamespace, Context } from 'openland-utils/Context';
import { FTransactionReadWrite } from 'foundation-orm/FTransactionReadWrite';
import { FTransactionReadOnly } from 'foundation-orm/FTransactionReadOnly';
import { FConnection } from 'foundation-orm/FConnection';
import { FTransaction } from 'foundation-orm/FTransaction';
import { createLogger } from 'openland-log/createLogger';

export const FTransactionContext = createContextNamespace<FTransactionReadWrite | null>('tx-rw', null);
export const FTransactionReadOnlyContext = createContextNamespace<FTransactionReadOnly | null>('tx-ro', null);
export const FConnectionContext = createContextNamespace<FConnection | null>('fdb-connection', null);

const log = createLogger('ephermal');
export function resolveContext(ctx: Context): FTransaction {
    let tx = FTransactionContext.get(ctx);
    if (tx) {
        return tx;
    }
    let cache = FTransactionReadOnlyContext.get(ctx);
    if (cache) {
        return cache;
    }

    log.warn(ctx, 'Using ephermal transaction! Consider using a permanent one.');
    return new FTransactionReadOnly();
}