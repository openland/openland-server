import { Context } from '@openland/context';
import { SLogContext } from './src/SLogContext';

export function withLogContext(ctx: Context, path: string[]): Context {
    let existing = SLogContext.get(ctx);
    return SLogContext.set(ctx, { path: [...existing.path, ...path], disabled: existing.disabled });
}