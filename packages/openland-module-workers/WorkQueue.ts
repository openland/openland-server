import { Store } from './../openland-module-db/FDB';
import { inTx, inTxLeaky } from '@openland/foundationdb';
import { delayBreakable, foreverBreakable } from 'openland-utils/timer';
import { uuid } from 'openland-utils/uuid';
import { exponentialBackoffDelay } from 'openland-utils/exponentialBackoffDelay';
import { EventBus } from 'openland-module-pubsub/EventBus';
import { Shutdown } from '../openland-utils/Shutdown';
import { Context, createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { getTransaction } from '@openland/foundationdb';
import { Events } from '../openland-module-hyperlog/Events';
// import { createMetric } from 'openland-module-monitoring/Metric';

const log = createLogger('worker');

// const metricStart = createMetric('worker-started', 'sum');
// const metricFailed = createMetric('worker-failed', 'sum');
// const metricEnd = createMetric('worker-commited', 'sum');
// const workerFetch = createMetric('worker-fetch', 'average');
// const workerPick = createMetric('worker-pick', 'average');

export class WorkQueue<ARGS> {
    private taskType: string;
    private pubSubTopic: string;
    private maxFailureCount: number;

    constructor(taskType: string, maxFailureCount: number = 5) {
        this.taskType = taskType;
        this.pubSubTopic = 'modern_work_added' + this.taskType;
        this.maxFailureCount = maxFailureCount;
    }

    pushWork = async (parent: Context, work: ARGS, startAt?: number) => {
        return await inTxLeaky(parent, async (ctx) => {
            getTransaction(ctx).afterCommit(() => {
                if (!startAt) {
                    EventBus.publish(this.pubSubTopic, {});
                }
            });
            // Do UNSAFE task creation since there won't be conflicts because our is is guaranteed to be unique (uuid)
            return await Store.Task.create_UNSAFE(ctx, this.taskType, uuid(), {
                arguments: work,
                taskStatus: 'pending',
                taskMaxFailureCount: this.maxFailureCount,
                taskFailureCount: 0,
                taskLockTimeout: 0,
                taskLockSeed: '',
                startAt: startAt || null,
                result: null,
                taskFailureMessage: null,
                taskFailureTime: null
            });
        });
    }

    addWorker = (handler: (item: ARGS, ctx: Context) => void | Promise<void>) => {
        let working = true;
        const lockSeed = uuid();
        let awaiter: (() => void) | undefined;
        EventBus.subscribe(this.pubSubTopic, () => {
            if (awaiter) {
                awaiter();
                awaiter = undefined;
            }
        });
        let awaitTask = async () => {
            let w = delayBreakable(5000);
            awaiter = w.resolver;
            await w.promise;
        };
        let root = createNamedContext('worker-' + this.taskType);
        let rootExec = createNamedContext('task-' + this.taskType);
        let workLoop = foreverBreakable(root, async () => {
            // let start = currentRunningTime();
            let task = await inTx(root, async (ctx) => {
                getTransaction(ctx).setOptions({ causal_read_risky: true, priority_system_immediate: true });

                let pend = [
                    ...(await Store.Task.pending.query(ctx, this.taskType, { limit: 100 })).items,
                    ...(await Store.Task.delayedPending.query(ctx, this.taskType, { after: Date.now(), reverse: true, limit: 100 })).items
                ];
                if (pend.length === 0) {
                    return null;
                }
                let index = Math.floor(Math.random() * (pend.length));
                let res = pend[index];
                let raw = await getTransaction(ctx).getReadVersion();
                return { res, readVersion: raw };
            });
            // if (task) {
            //     workerFetch.add(root, currentRunningTime() - start);
            // }
            // start = currentRunningTime();
            let shouldExecute = task && await inTx(root, async (ctx) => {
                getTransaction(ctx).setOptions({
                    causal_read_risky: true,
                    priority_system_immediate: true,
                    retry_limit: 10
                });

                let tsk = await Store.Task.findById(ctx, task!.res.taskType, task!.res.uid);
                if (!tsk) {
                    return false;
                }
                if (tsk.taskStatus !== 'pending') {
                    if (tsk.taskStatus === 'executing' && tsk.taskLockSeed === lockSeed) {
                        return true;
                    }
                    return false;
                }
                tsk.taskLockSeed = lockSeed;
                tsk.taskLockTimeout = Date.now() + 15000;
                tsk.taskStatus = 'executing';
                Events.TaskScheduled.event(ctx, { taskId: tsk.uid, taskType: tsk.taskType, duration: Date.now() - (tsk.startAt ||  tsk.metadata.createdAt) });
                return true;
            });

            if (task && shouldExecute) {
                // workerPick.add(root, currentRunningTime() - start);
                // log.log(root, 'Task ' + task.uid + ' found');
                // let start = currentTime();
                let breakDelay: (() => void) | undefined;
                let lockLoop = foreverBreakable(root, async () => {
                    let d = await delayBreakable(10000);
                    breakDelay = d.resolver;
                    await d.promise;
                    await inTx(root, async ctx => {
                        let tsk = (await Store.Task.findById(ctx, task!.res.taskType, task!.res.uid))!;
                        if (!tsk) {
                            return;
                        }
                        tsk.taskLockTimeout = Date.now() + 15000;
                    });
                });
                const stopLocking = async () => {
                    if (breakDelay) {
                        breakDelay();
                    }
                    await lockLoop.stop();
                };
                try {
                    // metricStart.increment(root);
                    await handler(task.res.arguments, rootExec);
                } catch (e) {
                    // metricFailed.increment(rootExec);
                    log.warn(root, e);
                    await inTx(root, async (ctx) => {
                        let res2 = await Store.Task.findById(ctx, task!!.res.taskType, task!!.res.uid);
                        if (res2) {
                            if (res2.taskLockSeed === lockSeed && res2.taskStatus === 'executing') {
                                res2.taskStatus = 'failing';
                                res2.taskFailureMessage = e.message ? e.message : null;
                                if (res2.taskFailureCount === null) {
                                    res2.taskFailureCount = 1;
                                    res2.taskFailureTime = Math.floor(Date.now() + exponentialBackoffDelay(res2.taskFailureCount!, 1000, 10000, 5));
                                } else {
                                    if (this.maxFailureCount >= 0 && res2.taskFailureCount === this.maxFailureCount - 1) {
                                        log.warn(ctx, 'Task Failed');
                                        res2.taskFailureCount = this.maxFailureCount;
                                        res2.taskStatus = 'failed';
                                    } else {
                                        let delay = Math.floor(exponentialBackoffDelay(res2.taskFailureCount!, 1000, 10000, 5));
                                        log.warn(ctx, 'Task is Failing: ' + delay);
                                        res2.taskFailureCount++;
                                        res2.taskFailureTime = Date.now() + delay;
                                    }
                                }

                                return true;
                            }
                        }
                        return false;
                    });
                    await awaitTask();
                    return;
                } finally {
                    await stopLocking();
                }

                // log.log(root, 'Task ' + task.uid + ' completed in ' + (currentTime() - start) + ' ms');

                // Commiting
                let commited = await inTx(root, async (ctx) => {
                    let res2 = await Store.Task.findById(ctx, task!!.res.taskType, task!!.res.uid);
                    if (res2) {
                        if (res2.taskLockSeed === lockSeed && res2.taskStatus === 'executing') {
                            await res2.delete(ctx);
                            Events.TaskCompleted.event(ctx, { taskId: res2.uid, taskType: res2.taskType, duration: Date.now() - res2.metadata.createdAt });
                            return true;
                        }
                    }
                    return false;
                });
                if (commited) {
                    // metricEnd.increment(root);
                    // log.log(root, 'Commited');
                } else {
                    log.log(root, 'Not commited');
                    await awaitTask();
                }
            } else {
                // log.debug(root, 'Task not found');
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

        return {
            shutdown
        };
    }
}
