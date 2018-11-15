import { Context } from 'openland-utils/Context';
import { SLogContext } from './src/SLogContext';

export function withLogContext(ctx: Context, path: string | string[]): Context {
    let existing = SLogContext.get(ctx);
    return SLogContext.set(ctx, { path: [...existing.path, ...path], disabled: existing.disabled });
}