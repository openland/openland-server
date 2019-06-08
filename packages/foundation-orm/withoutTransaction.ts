import { Context } from '@openland/context';
import { FTransactionContext, FTransactionReadOnlyContext } from './utils/contexts';

export function withoutTransaction(ctx: Context) {
    let res = ctx;
    res = FTransactionContext.set(res, null);
    res = FTransactionReadOnlyContext.set(res, null);
    return res;
}