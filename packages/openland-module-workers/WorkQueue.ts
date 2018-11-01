import { JsonMap } from 'openland-server/utils/json';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';
import { forever, delayBreakable } from 'openland-server/utils/timer';
import { uuid } from 'openland-utils/uuid';
import { withLogContext } from 'openland-log/withLogContext';
import { createLogger } from 'openland-log/createLogger';
import { exponentialBackoffDelay } from 'openland-server/utils/exponentialBackoffDelay';
import { EventBus } from 'openland-module-pubsub/EventBus';
import { FTransaction } from 'foundation-orm/FTransaction';
import { createHyperlogger } from 'openland-module-hyperlog/createHyperlogEvent';

const workCompleted = createHyperlogger<{ taskId: string, taskType: string, duration: number }>('task_completed');
const workScheduled = createHyperlogger<{ taskId: string, taskType: string, duration: number }>('task_scheduled');
export class WorkQueue<ARGS, RES extends JsonMap> {
    private taskType: string;
    private pubSubTopic: string;

    constructor(taskType: string) {
        this.taskType = taskType;
        this.pubSubTopic = 'modern_work_added' + this.taskType;
    }

    pushWork = async (work: ARGS) => {
        return await inTx(async () => {
            FTransaction.context!!.value!.afterTransaction(() => {
                EventBus.publish(this.pubSubTopic, {});
            });
            return await FDB.Task.create(this.taskType, uuid(), {
                arguments: work,
                taskStatus: 'pending',
                taskFailureCount: 0,
                taskLockTimeout: 0,
                taskLockSeed: ''
            });

        });
    }

    addWorker = (handler: (item: ARGS, uid: string) => RES | Promise<RES>) => {
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
        forever(async () => {
            await withLogContext(['worker', this.taskType], async () => {
                let task = await inTx(async () => {
                    let pend = await FDB.Task.rangeFromPending(this.taskType, 1);
                    if (pend.length === 0) {
                        return null;
                    }
                    let res = pend[0];
                    res.taskLockSeed = lockSeed;
                    res.taskLockTimeout = Date.now() + 15000;
                    res.taskStatus = 'executing';
                    await workScheduled.event({ taskId: res.uid, taskType: res.taskType, duration: Date.now() - res.createdAt });
                    return res;
                });
                if (task) {
                    log.log('Task ' + task.uid + ' found');
                    let res: RES;
                    try {
                        res = await handler(task.arguments, task.uid);
                    } catch (e) {
                        console.warn(e);
                        await inTx(async () => {
                            let res2 = await FDB.Task.findById(task!!.taskType, task!!.uid);
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

                    log.log('Task ' + task.uid + ' completed', JSON.stringify(res));

                    // Commiting
                    let commited = await inTx(async () => {
                        let res2 = await FDB.Task.findById(task!!.taskType, task!!.uid);
                        if (res2) {
                            if (res2.taskLockSeed === lockSeed && res2.taskStatus === 'executing') {
                                res2.taskStatus = 'completed';
                                res2.result = res;
                                await workCompleted.event({ taskId: res2.uid, taskType: res2.taskType, duration: Date.now() - res2.createdAt });
                                return true;
                            }
                        }
                        return false;
                    });
                    if (commited) {
                        log.log('Commited');
                    } else {
                        log.log('Not commited');
                        await awaitTask();
                    }
                } else {
                    log.debug('Task not found');
                    await awaitTask();
                }
            });
        });
    }
}