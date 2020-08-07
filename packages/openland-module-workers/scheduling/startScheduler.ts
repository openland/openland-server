import { Shutdown } from 'openland-utils/Shutdown';
import { WorkQueueRepository } from '../repo/WorkQueueRepository';
import { inTx } from '@openland/foundationdb';
import { createNamedContext, Context } from '@openland/context';
import { backoff, delay } from 'openland-utils/timer';
import { Store } from 'openland-module-db/FDB';

export function startScheduler() {
    let root = createNamedContext('scheduler');

    let stopped = false;
    let onCompleted: () => void = () => { /**/ };
    let promise = new Promise((r) => onCompleted = r);

    // tslint:disable-next-line:no-floating-promises
    (async () => {
        try {

            // Load directory
            let repo = await backoff(root, async () => {
                if (stopped) {
                    return null;
                }
                return await inTx(root, async (ctx) => {
                    return await WorkQueueRepository.open(ctx, Store.storage.db);
                });
            });
            if (stopped) {
                return;
            }
            if (!repo) {
                return;
            }

            // Refresh loop
            while (!stopped) {
                await delay(1000);
                await backoff(root, async () => {
                    await inTx(root, async (ctx) => {
                        await repo!.rescheduleTasks(ctx, Date.now());
                    });
                });
            }
        } finally {
            onCompleted();
        }
    })();

    const shutdown = async (ctx: Context) => {
        stopped = true;
        await promise;
    };

    Shutdown.registerWork({ name: 'task-scheduler', shutdown });
}