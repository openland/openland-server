import { backoff } from 'openland-utils/timer';
import { Context } from '@openland/context';
import { getTransaction, TransactionCache, withoutTransaction } from '@openland/foundationdb';
import { onContextCancel, delayBreakable } from '@openland/lifetime';
import { Store } from './FDB';

const cache = new TransactionCache<Set<string>>('fast-watc-notify');

export function notifyFastWatch(ctx: Context, key: string) {
    let notifications = cache.get(ctx, 'fast-watch');
    if (!notifications) {
        notifications = new Set();
        getTransaction(ctx).beforeCommit((ctx2) => {
            for (let n of notifications!) {
                Store.storage.eventBus.publish(ctx2, 'fast-watch-' + n, {});
            }
        });
    }
    notifications.add(key);
}

export async function fastWatch(parent: Context, key: string, lastVersion: number, entity: (ctx: Context) => Promise<number>): Promise<{ result: false } | { result: true, version: number }> {
    let aborted = false;
    let changed = false;
    let awaiter: (() => void) | undefined = undefined;
    let subscription = Store.storage.eventBus.subscibe('fast-watch-' + key, () => {
        if (awaiter) {
            awaiter();
            awaiter = undefined;
        }
    });
    let ctx = withoutTransaction(parent); // Clear transaction information since live stream manage transactions by itself
    onContextCancel(ctx, () => aborted = true);
    let version = lastVersion;
    try {
        while (!aborted && !changed) {

            // Fetch new version
            let v = await backoff(ctx, () => Store.storage.db.microtasks.execute((c) => entity(c)));
            if (v > lastVersion) {
                changed = true;
                version = v;
            }

            // Refetch entity
            if (!changed && !aborted) {
                let w = delayBreakable(ctx, 10000 + Math.random() * 15000);
                awaiter = w.cancel;
                await w.wait;
                awaiter = undefined;
            }
        }
    } finally {
        subscription.cancel();
    }

    if (aborted) {
        return { result: false };
    } else {
        return { result: true, version };
    }
}