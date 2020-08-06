import uuid from 'uuid/v4';
import { createLogger } from '@openland/log';
import { delayBreakable, foreverBreakable, currentRunningTime } from 'openland-utils/timer';
import { Shutdown } from 'openland-utils/Shutdown';
import { EventBus } from 'openland-module-pubsub/EventBus';
import { getTransaction, inTx, TransactionCache } from '@openland/foundationdb';
import { Context, createNamedContext } from '@openland/context';
import { QueueStorage } from './QueueStorage';
import { Metrics } from 'openland-module-monitoring/Metrics';

const log = createLogger('worker');

const hadNotification = new TransactionCache<boolean>('work-queue-notification');

export class TransactionalWorkerQueue<ARGS> {
    private queue: QueueStorage;
    private maxAttempts: number | 'infinite';
    private topic: string;

    constructor(queue: QueueStorage, maxAttempts: number | 'infinite') {
        this.queue = queue;
        this.maxAttempts = maxAttempts;
        this.topic = 'queue-' + queue.name;
    }

    async getTotal(ctx: Context) {
        return this.queue.getTotal(ctx);
    }

    async getFailures(ctx: Context) {
        return this.queue.getFailures(ctx);
    }

    async getActive(ctx: Context) {
        return this.queue.getActive(ctx);
    }

    async getCompleted(ctx: Context) {
        return this.queue.getCompleted(ctx);
    }

    pushWork = (ctx: Context, work: ARGS) => {
        this.queue.pushWork(ctx, work, this.maxAttempts);

        let wasNotified = hadNotification.get(ctx, this.queue.name) || false;
        if (!wasNotified) {
            hadNotification.set(ctx, this.queue.name, true);

            // Request version stamp
            let versionStamp = getTransaction(ctx)
                .rawTransaction(this.queue.db)
                .getVersionstamp();

            // Send event after transaction
            getTransaction(ctx).afterCommit(() => {
                // tslint:disable-next-line:no-floating-promises
                versionStamp.promise.then((vt) => {
                    EventBus.publish(this.topic, { vs: vt.toString('hex') });
                });
            });
        }
    }

    addWorkers = (parallel: number, handler: (ctx: Context, item: ARGS) => Promise<void>) => {
        let working = true;

        // Task Awaiting
        let awaiter: (() => void) | undefined;
        EventBus.subscribe(this.topic, () => {
            if (awaiter) {
                awaiter();
                awaiter = undefined;
            }
        });
        let awaitTask = async () => {
            let w = delayBreakable(1000);
            awaiter = w.resolver;
            await w.promise;
        };

        let completedAwait: (() => void) | undefined;
        let awaitCompleted = async () => {
            let w = delayBreakable(1000);
            completedAwait = w.resolver;
            await w.promise;
        };
        let allWorkersCompleted = () => {
            if (completedAwait) {
                completedAwait();
            }
        };

        // Worker Awaiting
        let workerAwaiter: (() => void) | undefined;
        let workerReady = () => {
            if (workerAwaiter) {
                workerAwaiter();
                workerAwaiter = undefined;
            }
        };
        let activeTasks = 0;
        let awaitWorker = async () => {
            if (activeTasks < parallel) {
                return;
            }
            let w = delayBreakable(15000);
            workerAwaiter = w.resolver;
            await w.promise;
        };

        // Working Loop
        let seed = Buffer.alloc(16);
        uuid(undefined, seed);
        let root = createNamedContext('worker-' + this.queue.name);
        let rootExec = createNamedContext('task-' + this.queue.name);
        let workLoop = foreverBreakable(root, async () => {

            // Wait for available workers
            await awaitWorker();
            if (!working) {
                return;
            }

            // Resolve desired tasks limit
            let workersToAllocate = Math.min(Math.max(parallel - activeTasks, 0), 20);
            if (workersToAllocate === 0) {
                return;
            }

            // Acquiring tasks
            let start = currentRunningTime();
            let tasks = await inTx(root, async (ctx) => {
                return await this.queue.acquireWork(ctx, workersToAllocate, seed, 10000);
            });
            Metrics.WorkerAcquire.report(this.queue.name, currentRunningTime() - start);

            // Await tasks if needed
            if (tasks.length === 0) {
                if (!working) {
                    return;
                }
                await awaitTask();
                return;
            }

            // Start workers
            for (let i = 0; i < tasks.length; i++) {
                let taskId = tasks[i];

                // tslint:disable-next-line:no-floating-promises
                (async () => {
                    try {
                        let startEx = currentRunningTime();
                        await inTx(rootExec, async ctx => {

                            // Getting task arguments and checking lock
                            let args = await this.queue.resolveTask(ctx, taskId, seed);
                            if (!args) {
                                return;
                            }

                            // Mark work as completed
                            await this.queue.completeWork(ctx, taskId);

                            // Perform work
                            await handler(ctx, args);
                        });
                        Metrics.WorkerExecute.report(this.queue.name, currentRunningTime() - startEx);
                    } catch (e) {
                        log.error(rootExec, e);
                    } finally {
                        // Reduce active tasks count
                        activeTasks--;
                        workerReady();

                        // TODO: There could be a race condition when queue already stopping
                        //       and new task could be scheduled right after this.
                        if (activeTasks) {
                            allWorkersCompleted();
                        }
                    }
                })();
            }

            // Await tasks if needed
            if (tasks.length === 0) {
                await awaitTask();
            }
        });

        const shutdown = async (ctx: Context) => {
            if (!working) {
                throw new Error('Worker already stopped');
            }

            working = false;

            if (workerAwaiter) {
                workerAwaiter();
                workerAwaiter = undefined;
            }
            if (awaiter) {
                awaiter();
                awaiter = undefined;
            }

            if (activeTasks > 0) {
                await awaitCompleted();
            }

            await workLoop.stop();
        };

        Shutdown.registerWork({ name: this.queue.name, shutdown });
    }
}