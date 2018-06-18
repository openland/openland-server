import { LockState, LockProvider, DynamicLock } from './dynamicLocking';
import { delay, forever, delayBreakable } from '../utils/timer';
import { DB } from '../tables';
import { JsonMap } from '../utils/json';
import { tryLock } from './locking';
import sequelize, { Transaction } from 'sequelize';
import { exponentialBackoffDelay } from '../utils/exponentialBackoffDelay';
import { Pubsub } from './pubsub';
import * as UUID from 'uuid/v4';

class TaskLocker implements LockProvider {

    private taskId: number;
    constructor(taskId: number) {
        this.taskId = taskId;
    }

    async lock(seed: string, timeout: number) {
        let now = Date.now();
        return await DB.connection.transaction({ logging: false as any }, async (tx) => {
            let task = await DB.Task.findById(this.taskId, { lock: tx.LOCK.UPDATE, transaction: tx, logging: false });
            if (!task) {
                return false;
            }
            if (!task.taskLockSeed || (task.taskLockSeed === seed || task.taskLockTimeout!!.getTime() < now)) {
                task.taskLockTimeout = new Date(timeout);
                await task.save({ transaction: tx, logging: false });
                return true;
            }
            return false;
        });
    }
    async unlock(seed: string) {
        return await DB.connection.transaction({ logging: false as any }, async (tx) => {
            let task = await DB.Task.findById(this.taskId, { lock: tx.LOCK.UPDATE, transaction: tx, logging: false });
            if (!task) {
                return false;
            }
            if (task.taskLockSeed === seed) {
                task.taskLockSeed = null;
                task.taskLockTimeout = null;
                await task.save({ transaction: tx });
                return true;
            }
            return false;
        });
    }
    async refresh(seed: string, timeout: number) {
        return this.lock(seed, timeout);
    }
}

const pubsub = new Pubsub<{ taskId: number }>();
const Locker = new DynamicLock({ lockTimeout: 10000, refreshInterval: 1000 });
const MaximumFailingNumber = 5;

export function startScheduller() {
    forever(async () => {
        let res = await DB.connection.transaction({ logging: false as any }, async (tx) => {

            // Prerequisites
            if (!(await tryLock(tx, 'work_scheduler', 1))) {
                return false;
            }

            let processed = false;

            // Mark failed
            // Move to failed if 
            //      status is 'failing' AND taskFailureCount >= MaximumFailingNumber AND Not Locked
            let now = new Date();
            let failed = (await DB.Task.update({ taskStatus: 'failed' }, {
                where: {
                    taskStatus: 'failing',
                    taskFailureCount: {
                        $gte: MaximumFailingNumber
                    },
                    taskLockTimeout: {
                        $or: [null, { $lte: now }]
                    }
                },
                transaction: tx,
                logging: false
            }))[0];
            if (failed > 0) {
                console.warn('Failed ' + failed + ' tasks');
                processed = true;
            }

            // Retry failing
            // Move to pending if
            //      status is 'failing' AND taskFailureCount < MaximumFailingNumber AND (taskFailureTime < now OR taskFailureTime null) AND Not Locked
            let retried = (await DB.Task.update({ taskStatus: 'pending' }, {
                where: {
                    taskStatus: 'failing',
                    taskFailureCount: {
                        $lt: MaximumFailingNumber
                    },
                    taskFailureTime: {
                        $or: [null, { $lte: now }]
                    },
                    taskLockTimeout: {
                        $or: [null, { $lte: now }]
                    }
                },
                transaction: tx,
                logging: false
            }))[0];
            if (retried > 0) {
                console.warn('Retried ' + retried + ' tasks');
                processed = true;
            }

            // Timeouting stale tasks
            // Move to failing if
            //      status is 'executing' AND Not Locked
            let timeouted = (await DB.Task.update({
                taskStatus: 'failing',
                taskFailureCount: sequelize.literal('"taskFailureCount" + 1') as any,
                taskFailureTime: new Date(Date.now() + 1000)
            }, {
                    where: {
                        taskStatus: 'executing',
                        taskLockTimeout: {
                            $or: [null, { $lte: now }]
                        },
                    },
                    transaction: tx,
                    logging: false
                }))[0];
            if (timeouted > 0) {
                console.warn('Timeouted ' + timeouted + ' tasks');
                processed = true;
            }

            return processed;
        });
        if (res) {
            await delay(100);
        } else {
            await delay(10000);
        }
    });
}

export class WorkQueue<ARGS extends JsonMap, RES extends JsonMap> {
    private taskType: string;

    constructor(taskType: string) {
        this.taskType = taskType;
    }

    pushWork = async (work: ARGS, tx?: Transaction) => {
        let res = (await DB.Task.create({
            uid: UUID(),
            taskType: this.taskType,
            arguments: work
        }, { transaction: tx }));
        pubsub.publish('work_added', {
            taskId: res.id
        });
        return res;
    }

    addWorker = (handler: (item: ARGS, state: LockState, uid: string) => RES | Promise<RES>) => {
        let maxKnownWorkId = 0;
        let waiter: (() => void) | null = null;
        pubsub.subscribe('work_added', (data) => {
            if (waiter) {
                if (maxKnownWorkId < data.taskId) {
                    maxKnownWorkId = data.taskId;
                    waiter();
                }
                // if (lastOffset !== null && lastSecondary !== null) {
                //     let lastTime = new Date(lastOffset).getTime();
                //     let dataTime = new Date(data.offset).getTime();
                //     let changed = dataTime > lastTime || (dataTime === lastTime && lastSecondary > data.secondary);
                //     if (changed) {
                //         waiter();
                //     }
                // }
            }
        });
        forever(async () => {
            let task = await DB.Task.find({
                where: {
                    taskType: this.taskType,
                    taskStatus: 'pending'
                },
                order: [['id', 'asc']],
                logging: false
            });
            if (task) {
                console.warn('Task #' + task.id);
                await Locker.within(new TaskLocker(task.id), async (state) => {
                    // Switch status to executing
                    await task!!.reload({ logging: false });
                    state.check();
                    task!!.taskStatus = 'executing';
                    await task!!.save({ logging: false });

                    // Executing handler
                    let res: RES;
                    try {
                        res = await handler(task!!.arguments as ARGS, state, task!!.uid);
                    } catch (e) {
                        console.warn(e);

                        // Mark as failed
                        state.check();
                        let failureCount = (task!!.taskFailureCount || 0) + 1;
                        task!!.taskFailureTime = new Date(Date.now() + exponentialBackoffDelay(failureCount, 1000, 10000, MaximumFailingNumber));
                        task!!.taskFailureCount = (task!!.taskFailureCount || 0) + 1;
                        task!!.taskStatus = 'failing';
                        await task!!.save({ logging: false });
                        return;
                    }

                    // Mark as completed
                    state.check();
                    task!!.result = res;
                    task!!.taskStatus = 'completed';
                    await task!!.save({ logging: false });
                });
                await delay(100);
            } else {
                let b = delayBreakable(10000);
                waiter = b.resolver;
                await b.promise;
                waiter = null;
            }
        });
    }
}