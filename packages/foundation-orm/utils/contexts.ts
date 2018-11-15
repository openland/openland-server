import { createContextNamespace, Context } from 'openland-utils/Context';
import { FTransaction } from 'foundation-orm/FTransaction';
import { FConnection } from 'foundation-orm/FConnection';

export const FTransactionContext = createContextNamespace<FTransaction | null>('tx', null);

export function resolveContext(ctx: Context) {
    let tx = FTransactionContext.get(ctx);
    if (tx) {
        return tx;
    } else {
        return FConnection.globalContext;
    }
}