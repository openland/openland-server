import { Context } from '@openland/context';
import { SLogContext, SLogContext2 } from './src/SLogContext';

export function withLogContext(ctx: Context, path: string[]): Context {
    let existing = SLogContext.get(ctx);
    return SLogContext.set(ctx, { path: [...existing.path, ...path], disabled: existing.disabled });
}

export function withLogData(ctx: Context, fields: any): Context {
    let src = { ...SLogContext2.get(ctx), ...fields };
    return SLogContext2.set(ctx, src);
}