import { createLogger } from '@openland/log';
import { delayBreakable, foreverBreakable } from 'openland-utils/timer';
import { Shutdown } from 'openland-utils/Shutdown';
import { EventBus } from 'openland-module-pubsub/EventBus';
import { getTransaction, inTx, Subspace, TupleItem, encoders } from '@openland/foundationdb';
import { Context, createNamedContext } from '@openland/context';
import { uuid } from 'openland-utils/uuid';
import { Metrics } from 'openland-module-monitoring/Metrics';

function shuffle<T>(a: T[]) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const log = createLogger('worker');

const METRIC_PUSHED = 0;
const METRIC_ACTIVE = 1;

export class TransWorkerQueue<ARGS> {
    private taskType: string;
    private pubSubTopic: string;
    private argsDirectory: Subspace<TupleItem[], any>;
    private idsDirectory: Subspace<TupleItem[], boolean>;
    private countersDirectory: Subspace<TupleItem[], number>;

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

        this.countersDirectory = directory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.int32LE)
            .subspace([2]);
    }

    async getTotal(ctx: Context) {
        return (await this.countersDirectory.get(ctx, [METRIC_PUSHED])) || 0;
    }

    async getActive(ctx: Context) {
        return (await this.countersDirectory.get(ctx, [METRIC_ACTIVE])) || 0;
    }

    pushWork = (ctx: Context, work: ARGS) => {
        let id = uuid();
        this.idsDirectory.set(ctx, [id], false);
        this.argsDirectory.set(ctx, [id], work);
        this.countersDirectory.add(ctx, [METRIC_PUSHED], 1);
        this.countersDirectory.add(ctx, [METRIC_ACTIVE], 1);
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
        let workerAwaiter: (() => void) | undefined;
        let workerReady = () => {
            if (workerAwaiter) {
                workerAwaiter();
                workerAwaiter = undefined;
            }
        };
        let activeTasks = new Set<string>();
        let awaitWorker = async () => {
            if (activeTasks.size < parallel) {
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
            let workersToAllocate = Math.max(parallel - activeTasks.size, 0);
            if (workersToAllocate === 0) {
                return;
            }
            let tasksLimit = Math.max(Math.min(10000, workersToAllocate * 1000), 1000);

            // Read batch of tasks
            let tasks = await inTx(root, async (ctx) => {
                return (await this.idsDirectory.range(ctx, [], { limit: tasksLimit })).map((v) => v.key[v.key.length - 1] as string);
            });

            // Filter already processing tasks
            tasks = tasks.filter((v) => !activeTasks.has(v));

            // Shuffle tasks
            tasks = shuffle(tasks);

            // Start workers
            for (let i = 0; i < tasks.length && i < workersToAllocate; i++) {
                let taskId = tasks[i];
                activeTasks.add(taskId);

                // tslint:disable-next-line:no-floating-promises
                (async () => {
                    try {
                        // Execute task
                        await inTx(rootExec, async (ctx) => {
                            Metrics.WorkerAttemptFrequence.inc(this.taskType);

                            let args = (await this.argsDirectory.get(ctx, [taskId])) as ARGS;
                            this.argsDirectory.clear(ctx, [taskId]);
                            this.idsDirectory.clear(ctx, [taskId]);

                            if (!args) {
                                return;
                            }
                            
                            await handler(ctx, args);

                            this.countersDirectory.add(ctx, [METRIC_ACTIVE], -1);

                            getTransaction(ctx).afterCommit(() => {
                                Metrics.WorkerSuccessFrequence.inc(this.taskType);
                            });
                        });
                    } catch (e) {
                        log.error(rootExec, e);
                    } finally {

                        // Reduce active tasks count
                        activeTasks.delete(taskId);
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