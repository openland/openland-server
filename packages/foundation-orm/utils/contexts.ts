import { createContextNamespace, Context } from 'openland-utils/Context';
import { FTransaction } from 'foundation-orm/FTransaction';
import { FConnection } from 'foundation-orm/FConnection';
import { FCacheContext } from 'foundation-orm/FCacheContext';

export const FTransactionContext = createContextNamespace<FTransaction | null>('tx', null);
export const FCacheContextContext = createContextNamespace<FCacheContext | null>('tx-cache', null);

export function resolveContext(ctx: Context) {
    let tx = FTransactionContext.get(ctx);
    if (tx) {
        return tx;
    }
    // let cache = FCacheContextContext.get(ctx);
    // if (cache) {
    //     return cache;
    // }
    return FConnection.globalContext;
}