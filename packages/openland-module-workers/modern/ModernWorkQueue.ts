import { JsonMap } from 'openland-server/utils/json';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';
import { forever, delay } from 'openland-server/utils/timer';
import { uuid } from 'openland-utils/uuid';
import { withLogContext } from 'openland-log/withLogContext';
import { createLogger } from 'openland-log/createLogger';
import { exponentialBackoffDelay } from 'openland-server/utils/exponentialBackoffDelay';

export class ModernWorkQueue<ARGS extends JsonMap, RES extends JsonMap> {
    private taskType: string;
    // private pubSubTopic: string;

    constructor(taskType: string) {
        this.taskType = taskType;
        // this.pubSubTopic = 'modern_work_added' + this.taskType;
    }

    pushWork = async (work: ARGS) => {
        return await inTx(async () => {
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
                    return res;
                });
                if (task) {
                    log.log('Task found');
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
                        await delay(1000);
                        return;
                    }

                    log.log('Task completed');

                    // Commiting
                    let commited = await inTx(async () => {
                        let res2 = await FDB.Task.findById(task!!.taskType, task!!.uid);
                        if (res2) {
                            if (res2.taskLockSeed === lockSeed && res2.taskStatus === 'executing') {
                                res2.taskStatus = 'completed';
                                res2.result = res;
                                return true;
                            }
                        }
                        return false;
                    });
                    if (commited) {
                        log.log('Commited');
                        await delay(1000);
                    } else {
                        log.log('Not commited');
                        await delay(5000);
                    }
                } else {
                    log.log('Task not found');
                    await delay(1000);
                }
            });
        });
    }
}