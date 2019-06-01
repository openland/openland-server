import { Context } from 'openland-utils/Context';
import { FTransactionReadOnlyContext } from './utils/contexts';
import { FTransactionReadOnly } from './tx/FTransactionReadOnly';

export function withReadOnlyTransaction(ctx: Context): Context {
    let ex = FTransactionReadOnlyContext.get(ctx);
    if (ex) {
        return ctx;
    }

    let cache = new FTransactionReadOnly();
    ctx = FTransactionReadOnlyContext.set(ctx, cache);
    return ctx;
}