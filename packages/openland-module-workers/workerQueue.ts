import { LockState, LockProvider, DynamicLock } from 'openland-server/modules/dynamicLocking';
import { delay, forever, delayBreakable } from 'openland-server/utils/timer';
import { DB, DB_SILENT } from 'openland-server/tables';
import { JsonMap } from 'openland-server/utils/json';
import sequelize, { Transaction } from 'sequelize';
import { exponentialBackoffDelay } from 'openland-server/utils/exponentialBackoffDelay';
import { Pubsub } from 'openland-server/modules/pubsub';
import UUID from 'uuid/v4';
import { LockRepository } from 'openland-repositories/LockRepository';

class TaskLocker implements LockProvider {

    private taskId: number;
    constructor(taskId: number) {
        this.taskId = taskId;
    }

    async lock(seed: string, timeout: number) {
        let now = Date.now();
        return await DB.connection.transaction({ logging: DB_SILENT as any }, async (tx) => {
            let task = await DB.Task.findById(this.taskId, { lock: tx.LOCK.UPDATE, transaction: tx, logging: DB_SILENT });
            if (!task) {
                return false;
            }
            if (!task.taskLockSeed || (task.taskLockSeed === seed || task.taskLockTimeout!!.getTime() < now)) {
                task.taskLockSeed = seed;
                task.taskLockTimeout = new Date(timeout);
                await task.save({ transaction: tx, logging: DB_SILENT });
                return true;
            }
            return false;
        });
    }
    async unlock(seed: string) {
        return await DB.connection.transaction({ logging: DB_SILENT as any }, async (tx) => {
            let task = await DB.Task.findById(this.taskId, { lock: tx.LOCK.UPDATE, transaction: tx, logging: DB_SILENT });
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
const MaximumFailingNumber = 5;

export function startScheduller() {
    forever(async () => {
        let res = await DB.connection.transaction({ logging: DB_SILENT as any }, async (tx) => {

            // Prerequisites
            if (!(await LockRepository.tryLock('work_scheduler', 1))) {
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
                logging: DB_SILENT
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
                logging: DB_SILENT
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
                    logging: DB_SILENT
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
    private locker = new DynamicLock({ lockTimeout: 10000, refreshInterval: 1000 });
    private pubSubTopic: string;

    constructor(taskType: string) {
        this.taskType = taskType;
        this.pubSubTopic = 'work_added' + this.taskType;
    }

    pushWork = async (work: ARGS, tx?: Transaction) => {
        let res = (await DB.Task.create({
            uid: UUID(),
            taskType: this.taskType,
            arguments: work
        }, { transaction: tx }));
        if (tx) {
            (tx as any).afterCommit(() => {
                // tslint:disable-next-line:no-floating-promises
                pubsub.publish(this.pubSubTopic, {
                    taskId: res.id
                });
            });
        } else {
            // tslint:disable-next-line:no-floating-promises
            pubsub.publish(this.pubSubTopic, {
                taskId: res.id
            });
        }
        
        return res;
    }

    addWorker = (handler: (item: ARGS, state: LockState, uid: string) => RES | Promise<RES>) => {
        let maxKnownWorkId = 0;
        let waiter: (() => void) | null = null;
        // tslint:disable-next-line:no-floating-promises
        pubsub.subscribe(this.pubSubTopic, (data) => {
            if (waiter) {
                if (maxKnownWorkId < data.taskId) {
                    maxKnownWorkId = data.taskId;
                    waiter();
                }
            }
        });
        forever(async () => {
            let task = await DB.Task.find({
                where: {
                    taskType: this.taskType,
                    taskStatus: 'pending'
                },
                order: [['id', 'asc']],
                logging: DB_SILENT
            });
            if (task) {
                console.warn('Task #' + task.id);
                await this.locker.within(new TaskLocker(task.id), async (state) => {
                    // Switch status to executing
                    await task!!.reload({ logging: DB_SILENT });
                    state.check();
                    task!!.taskStatus = 'executing';
                    await task!!.save({ logging: DB_SILENT });

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
                        await task!!.save({ logging: DB_SILENT });
                        return;
                    }

                    // Mark as completed
                    state.check();
                    task!!.result = res;
                    task!!.taskStatus = 'completed';
                    await task!!.save({ logging: DB_SILENT });
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