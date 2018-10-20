import { LockProvider } from 'openland-server/modules/dynamicLocking';
import { DB, DB_SILENT } from 'openland-server/tables';

export class LegacyTaskLocker implements LockProvider {

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