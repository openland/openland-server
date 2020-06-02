import { backoff } from 'openland-utils/timer';
import { Context } from '@openland/context';
import { withoutTransaction } from '@openland/foundationdb';
import { onContextCancel, delayBreakable } from '@openland/lifetime';
import { Store } from './FDB';

export function notifyFastWatch(parent: Context, key: string) {
    Store.storage.eventBus.publish(parent, 'fast-watch-' + key, {});
}

export async function fastWatch(parent: Context, key: string, entity: (ctx: Context) => Promise<number>) {
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
    let lastVersion = await entity(ctx);

    try {
        while (!aborted && !changed) {

            // Fetch new version
            let v = await backoff(ctx, () => entity(ctx));
            if (v > lastVersion) {
                changed = true;
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
        return false;
    } else {
        return true;
    }
}