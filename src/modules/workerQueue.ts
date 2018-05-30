import { LockState, LockProvider, DynamicLock } from './dynamicLocking';
import { delay, forever } from '../utils/timer';
import { DB } from '../tables';
import { JsonMap } from '../utils/json';

class TaskLocker implements LockProvider {

    private taskId: number;
    constructor(taskId: number) {
        this.taskId = taskId;
    }

    async lock(seed: string, timeout: number) {
        console.log('Lock ' + seed);
        let now = Date.now();
        return await DB.tx(async (tx) => {
            let task = await DB.Task.findById(this.taskId, { lock: tx.LOCK.UPDATE, transaction: tx });
            if (!task) {
                return false;
            }
            if (!task.taskLockSeed || (task.taskLockSeed === seed || task.taskLockTimeout!!.getTime() < now)) {
                task.taskLockTimeout = new Date(timeout);
                await task.save({ transaction: tx });
                return true;
            }
            return false;
        });
    }
    async unlock(seed: string) {
        console.log('Unlock ' + seed);
        return await DB.tx(async (tx) => {
            let task = await DB.Task.findById(this.taskId, { lock: tx.LOCK.UPDATE, transaction: tx });
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
        console.log('Refresh ' + seed);
        return this.lock(seed, timeout);
    }
}

const Locker = new DynamicLock({ lockTimeout: 10000, refreshInterval: 1000 });

export class WorkQueue<T extends JsonMap> {
    private taskType: string;

    constructor(taskType: string) {
        this.taskType = taskType;
    }

    pushWork = async (work: T) => {
        await DB.Task.create({
            taskType: this.taskType,
            arguments: work
        });
    }

    addWorker = (handler: (item: T, state: LockState) => void) => {
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
                    task!!.taskStatus = 'executing';
                    await task!!.save();

                    // Executing handler
                    try {
                        await handler(task!!.arguments as T, state);
                    } catch (e) {
                        console.warn(e);

                        // Mark as failed
                        state.check();
                        task!!.taskStatus = 'failed';
                        await task!!.save();
                        return;
                    }

                    // Mark as completed
                    state.check();
                    task!!.taskStatus = 'completed';
                    await task!!.save();
                });
                await delay(100);
            } else {
                await delay(1000);
            }
        });
    }
}