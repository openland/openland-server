import { createLogger } from '@openland/log';
import { delayBreakable, foreverBreakable } from 'openland-utils/timer';
import { Shutdown } from 'openland-utils/Shutdown';
import { EventBus } from 'openland-module-pubsub/EventBus';
import { getTransaction, inTx, Subspace, TupleItem, encoders } from '@openland/foundationdb';
import { Context, createNamedContext } from '@openland/context';
import { uuid } from 'openland-utils/uuid';

function shuffle<T>(a: T[]) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const log = createLogger('worker');

export class TransWorkerQueue<ARGS> {
    private taskType: string;
    private pubSubTopic: string;
    private argsDirectory: Subspace<TupleItem[], any>;
    private idsDirectory: Subspace<TupleItem[], boolean>;

    constructor(taskType: string, directory: Subspace<Buffer, Buffer>) {
        this.taskType = taskType;
        this.pubSubTopic = 'trans-worker-' + this.taskType;
        this.argsDirectory = directory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json)
            .subspace([1]);
        this.idsDirectory = directory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .subspace([0]);
    }

    pushWork = (ctx: Context, work: ARGS) => {
        let id = uuid();
        this.idsDirectory.set(ctx, [id], false);
        this.argsDirectory.set(ctx, [id], work);
        getTransaction(ctx).afterCommit(() => {
            EventBus.publish(this.pubSubTopic, {});
        });
    }

    addWorkers = (parallel: number, handler: (ctx: Context, item: ARGS) => Promise<void>) => {
        let working = true;

        // Task Awaiting
        let awaiter: (() => void) | undefined;
        EventBus.subscribe(this.pubSubTopic, () => {
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

        // Worker Awaiting
        let activeTasks = 0;
        let workerAwaiter: (() => void) | undefined;
        let workerReady = () => {
            if (workerAwaiter) {
                workerAwaiter();
                workerAwaiter = undefined;
            }
        };
        let awaitWorker = async () => {
            if (activeTasks < parallel) {
                return;
            }
            let w = delayBreakable(15000);
            workerAwaiter = w.resolver;
            await w.promise;
        };

        // Working Loop
        let root = createNamedContext('worker-' + this.taskType);
        let rootExec = createNamedContext('task-' + this.taskType);
        let workLoop = foreverBreakable(root, async () => {

            // Wait for available workers
            await awaitWorker();

            // Resolve desired tasks limit
            let workersToAllocate = Math.max(parallel - activeTasks, 0);
            if (workersToAllocate === 0) {
                return;
            }
            let tasksLimit = Math.max(Math.min(10000, workersToAllocate * 1000), 1000);

            // Read batch of tasks
            let tasks = await inTx(root, async (ctx) => {
                return (await this.idsDirectory.range(ctx, [], { limit: tasksLimit })).map((v) => v.key[v.key.length - 1] as string);
            });

            // Shuffle tasks
            tasks = shuffle(tasks);

            // Start workers
            for (let i = 0; i < tasks.length && i < workersToAllocate; i++) {
                activeTasks++;
                let taskId = tasks[0];

                // tslint:disable-next-line:no-floating-promises
                (async () => {
                    try {
                        // Execute task
                        await inTx(rootExec, async (ctx) => {
                            let args = (await this.argsDirectory.get(ctx, [taskId])) as ARGS;
                            if (!args) {
                                return;
                            }
                            this.argsDirectory.clear(ctx, [taskId]);

                            await handler(ctx, args);
                        });
                    } catch (e) {
                        log.error(rootExec, e);
                    } finally {

                        // Reduce active tasks count
                        activeTasks--;
                        workerReady();
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
            await workLoop.stop();
        };

        Shutdown.registerWork({ name: this.taskType, shutdown });
    }
}