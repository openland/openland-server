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
    private locksDirectory: Subspace<TupleItem[], { seed: string, timeout: number }>;
    private idsPendingDirectory: Subspace<TupleItem[], boolean>;

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

        this.locksDirectory = directory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json)
            .subspace([3]);

        this.idsPendingDirectory = directory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .subspace([4]);
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
        this.idsPendingDirectory.set(ctx, [id], true);
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
            let tasksLimit = Math.max(Math.min(40000, workersToAllocate * 1000), 40000);

            // Read batch of tasks
            let tasks = await inTx(root, async (ctx) => {
                getTransaction(ctx).setOptions({ causal_read_risky: true, priority_batch: true });
                
                return (await this.idsPendingDirectory.range(ctx, [], { limit: tasksLimit })).map((v) => v.key[v.key.length - 1] as string);
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
                    const lockSeed = uuid();
                    try {
                        let shouldExecute = await inTx(rootExec, async ctx => {
                            let args = (await this.argsDirectory.get(ctx, [taskId])) as ARGS;
                            if (!args) {
                                this.argsDirectory.clear(ctx, [taskId]);
                                this.idsDirectory.clear(ctx, [taskId]);
                                this.locksDirectory.clear(ctx, [taskId]);
                                this.idsPendingDirectory.clear(ctx, [taskId]);
                                return false;
                            }
                            const doLock = () => {
                                this.locksDirectory.set(ctx, [taskId], { seed: lockSeed, timeout: Date.now() + 15000 });
                                this.idsPendingDirectory.clear(ctx, [taskId]);
                            };

                            let lock = await this.locksDirectory.get(ctx, [taskId]);
                            if (lock) {
                                if (lock.seed === lockSeed) {
                                    doLock();
                                    return true;
                                } else if (Date.now() > lock.timeout) {
                                    doLock();
                                    return true;
                                } else {
                                    return false;
                                }
                            }
                            doLock();
                            return true;
                        });
                        if (!shouldExecute) {
                            return;
                        }
                        // Execute task
                        await inTx(rootExec, async (ctx) => {
                            getTransaction(ctx).setOptions({ causal_read_risky: true, priority_batch: true });

                            Metrics.WorkerAttemptFrequence.inc(this.taskType);

                            let args = (await this.argsDirectory.get(ctx, [taskId])) as ARGS;
                            this.argsDirectory.clear(ctx, [taskId]);
                            this.idsDirectory.clear(ctx, [taskId]);
                            this.locksDirectory.clear(ctx, [taskId]);
                            this.idsPendingDirectory.clear(ctx, [taskId]);

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