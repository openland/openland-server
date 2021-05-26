import { BetterWorkerQueue } from './BetterWorkerQueue';
import { QueueStorage } from './QueueStorage';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';

export class SyncWorkerQueue<K extends string | number, T> {

    private readonly queue: QueueStorage;
    private readonly workQueue: BetterWorkerQueue<{ id: K }>;
    private readonly type: 'transactional' | 'external';

    constructor(queue: QueueStorage, settings: { maxAttempts: number | 'infinite', type: 'transactional' | 'external' }) {
        this.queue = queue;
        this.type = settings.type;
        this.workQueue = new BetterWorkerQueue(queue, { maxAttempts: settings.maxAttempts, type: 'external' });
    }

    async pushWork(ctx: Context, key: K, task: T) {
        if (await this.queue.writePendingTask(ctx, key, task)) {
            this.workQueue.pushWork(ctx, { id: key });
        }
    }

    addWorker(parallel: number, handler: (ctx: Context, item: T[]) => Promise<void>) {
        this.workQueue.addWorkers(parallel, async (parent, args) => {
            const id = args.id;
            while (true) {
                const iteration = await inTx(parent, async (ctx) => {
                    return await this.queue.readPendingTasks(ctx, id);
                });

                // NOTE: Should not be possible
                if (!iteration || iteration.tasks.length === 0) {
                    return;
                }

                if (this.type === 'transactional') {
                    const commited = await inTx(parent, async (ctx) => {

                        // Handle tasks
                        await handler(ctx, iteration.tasks);

                        // Trying to commit
                        return await this.queue.commitTasks(ctx, id, iteration.counter, iteration.offset);
                    });
                    if (commited) {
                        return;
                    }
                } else {
                    // Handle tasks
                    await handler(parent, iteration.tasks);

                    // Trying to commit
                    const commited = await inTx(parent, async (ctx) => {
                        return await this.queue.commitTasks(ctx, id, iteration.counter, iteration.offset);
                    });
                    if (commited) {
                        return;
                    }
                }
            }
        });
    }
}