import { createContextNamespace, Context } from '@openland/context';

export const counterNamespace = createContextNamespace<{ readCount: number, writeCount: number } | null>('fdb-counter', null);

export function withCounters(ctx: Context) {
    return counterNamespace.set(ctx, { readCount: 0, writeCount: 0 });
}

export function reportCounters(ctx: Context) {
    let counters = counterNamespace.get(ctx);
    if (!counters) {
        return null;
    }
    return { readCount: counters.readCount, writeCount: counters.writeCount };
}