import { createContextNamespace, Context } from '@openland/context';

export const counterNamespace = createContextNamespace<{ readCount: number, writeCount: number, flushed: boolean } | null>('fdb-counter', null);

export function withCounters(ctx: Context) {
    return counterNamespace.set(ctx, { readCount: 0, writeCount: 0, flushed: false });
}

export function reportCounters(ctx: Context) {
    let counters = counterNamespace.get(ctx);
    if (!counters) {
        return;
    }
    if (counters.flushed) {
        return;
    }
    counters.flushed = true;
}