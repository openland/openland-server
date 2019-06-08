import { JsonMap } from 'openland-utils/json';
import { FDB } from 'openland-module-db/FDB';
import { inTx, inTxLeaky } from 'foundation-orm/inTx';
import { delayBreakable, foreverBreakable, currentTime } from 'openland-utils/timer';
import { uuid } from 'openland-utils/uuid';
import { createLogger } from 'openland-log/createLogger';
import { exponentialBackoffDelay } from 'openland-utils/exponentialBackoffDelay';
import { EventBus } from 'openland-module-pubsub/EventBus';
import { createHyperlogger } from 'openland-module-hyperlog/createHyperlogEvent';
import { Shutdown } from '../openland-utils/Shutdown';
import { getTransaction } from 'foundation-orm/getTransaction';
import { Context, createNamedContext } from '@openland/context';

const workCompleted = createHyperlogger<{ taskId: string, taskType: string, duration: number }>('task_completed');
const workScheduled = createHyperlogger<{ taskId: string, taskType: string, duration: number }>('task_scheduled');
export class WorkQueue<ARGS, RES extends JsonMap> {
    private taskType: string;
    private pubSubTopic: string;

    constructor(taskType: string) {
        this.taskType = taskType;
        this.pubSubTopic = 'modern_work_added' + this.taskType;
    }

    pushWork = async (parent: Context, work: ARGS) => {
        return await inTxLeaky(parent, async (ctx) => {
            getTransaction(ctx).afterCommit(() => {
                EventBus.publish(this.pubSubTopic, {});
            });
            // Do UNSAFE task creation since there won't be conflicts because our is is guaranteed to be unique (uuid)
            return await FDB.Task.create_UNSAFE(ctx, this.taskType, uuid(), {
                arguments: work,
                taskStatus: 'pending',
                taskFailureCount: 0,
                taskLockTimeout: 0,
                taskLockSeed: ''
            });

        });
    }

    addWorker = (handler: (item: ARGS, ctx: Context) => RES | Promise<RES>) => {
        let working = true;
        const lockSeed = uuid();
        const log = createLogger('handler');
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
        let workLoop = foreverBreakable(async () => {
            let task = await inTx(root, async (ctx) => {
                let pend = await FDB.Task.rangeFromPending(ctx, this.taskType, 1);
                if (pend.length === 0) {
                    return null;
                }
                let res = pend[Math.floor(Math.random() * (pend.length))];
                return res;
            });
            let locked = task && await inTx(root, async (ctx) => {
                let tsk = (await FDB.Task.findById(ctx, task!.taskType, task!.uid))!;
                if (tsk.taskStatus !== 'pending') {
                    return false;
                }
                tsk.taskLockSeed = lockSeed;
                tsk.taskLockTimeout = Date.now() + 15000;
                tsk.taskStatus = 'executing';
                await workScheduled.event(ctx, { taskId: tsk.uid, taskType: tsk.taskType, duration: Date.now() - tsk.createdAt });
                return true;
            });
            if (task && locked) {
                log.log(root, 'Task ' + task.uid + ' found');
                let start = currentTime();
                let res: RES;
                try {
                    res = await handler(task.arguments, root);
                } catch (e) {
                    console.warn(e);
                    await inTx(root, async (ctx) => {
                        let res2 = await FDB.Task.findById(ctx, task!!.taskType, task!!.uid);
                        if (res2) {
                            if (res2.taskLockSeed === lockSeed && res2.taskStatus === 'executing') {
                                res2.taskStatus = 'failing';
                                res2.taskFailureMessage = e.message ? e.message : null;
                                if (res2.taskFailureCount === null) {
                                    res2.taskFailureCount = 1;
                                    res2.taskFailureTime = Date.now() + exponentialBackoffDelay(res2.taskFailureCount!, 1000, 10000, 5);
                                } else {
                                    if (res2.taskFailureCount === 4) {
                                        res2.taskFailureCount = 5;
                                        res2.taskStatus = 'failed';
                                    } else {
                                        res2.taskFailureCount++;
                                        res2.taskFailureTime = Date.now() + exponentialBackoffDelay(res2.taskFailureCount!, 1000, 10000, 5);
                                    }
                                }

                                return true;
                            }
                        }
                        return false;
                    });
                    await awaitTask();
                    return;
                }

                log.log(root, 'Task ' + task.uid + ' completed in ' + (currentTime() - start) + ' ms');

                // Commiting
                let commited = await inTx(root, async (ctx) => {
                    let res2 = await FDB.Task.findById(ctx, task!!.taskType, task!!.uid);
                    if (res2) {
                        if (res2.taskLockSeed === lockSeed && res2.taskStatus === 'executing') {
                            res2.taskStatus = 'completed';
                            res2.result = res;
                            await workCompleted.event(ctx, { taskId: res2.uid, taskType: res2.taskType, duration: Date.now() - res2.createdAt });
                            return true;
                        }
                    }
                    return false;
                });
                if (commited) {
                    log.log(root, 'Commited');
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
            log.log(ctx, this.taskType, 'stopped');
        };

        Shutdown.registerWork({ name: this.taskType, shutdown });

        return {
            shutdown
        };
    }
}