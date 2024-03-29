import { backoff, delayBreakable } from 'openland-utils/timer';
import { Context } from '@openland/context';
import { getTransaction, TransactionCache, withoutTransaction } from '@openland/foundationdb';
import { onContextCancel, isContextCancelled } from '@openland/lifetime';
import { Store } from './FDB';
import { EventBus } from 'openland-module-pubsub/EventBus';

const cache = new TransactionCache<Set<string>>('fast-watc-notify');

export function notifyFastWatch(ctx: Context, key: string) {
    let notifications = cache.get(ctx, 'fast-watch');
    if (!notifications) {
        notifications = new Set();
        getTransaction(ctx).afterCommit(() => {
            for (let n of notifications!) {
                EventBus.publish('default', 'fast-watch-' + n, {});
            }
        });
    }
    notifications.add(key);
}

export async function fastWatch(parent: Context, key: string, lastVersion: number, entity: (ctx: Context) => Promise<number>): Promise<{ result: false } | { result: true, version: number }> {
    let aborted = false;
    let changed = false;
    let awaiter: (() => void) | undefined = undefined;
    let subscription = EventBus.subscribe('default', 'fast-watch-' + key, () => {
        if (awaiter) {
            awaiter();
            awaiter = undefined;
        }
    });
    let ctx = withoutTransaction(parent); // Clear transaction information since live stream manage transactions by itself
    if (isContextCancelled(ctx)) {
        return { result: false };
    }
    onContextCancel(ctx, () => {
        aborted = true;
        let a = awaiter;
        if (a) {
            awaiter = undefined;
            a();
        }
    });
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
                let w = delayBreakable(10000 + Math.random() * 15000);
                awaiter = w.resolver;
                await w.promise;
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