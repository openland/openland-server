import { Transaction } from 'sequelize';
import { DB, DB_SILENT } from '../tables';
import { forever, delay } from '../utils/timer';
import { LockRepository } from 'openland-repositories/LockRepository';

export function staticWorker(config: { name: string, version?: number, delay?: number }, worker: (tx: Transaction) => Promise<boolean>) {
    forever(async () => {
        let res = await DB.connection.transaction({ logging: DB_SILENT as any }, async (tx) => {
            // Locking
            if (!(await LockRepository.tryLock('worker_' + config.name, config.version))) {
                return false;
            }
            // Working
            return await worker(tx);
        });
        if (!res) {
            await delay(config.delay || 1000);
        } else {
            await delay(100);
        }
    });
}