import { Context } from 'openland-utils/Context';
import { FCacheContextContext } from './utils/contexts';
import { FCacheContext } from './FCacheContext';

export function withCache(ctx: Context): Context {
    let ex = FCacheContextContext.get(ctx);
    if (ex) {
        return ctx;
    }

    let cache = new FCacheContext();
    ctx = FCacheContextContext.set(ctx, cache);
    return ctx;
}