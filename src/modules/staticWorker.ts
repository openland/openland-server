import { Transaction } from 'sequelize';
import { DB } from '../tables';
import { forever, delay } from '../utils/timer';
import { tryLock } from './locking';

export function staticWorker(config: { name: string, version?: number, delay?: number }, worker: (tx: Transaction) => Promise<boolean>) {
    forever(async () => {
        let res = await DB.connection.transaction({ logging: false as any }, async (tx) => {
            // Locking
            if (!(await tryLock(tx, 'worker_' + config.name, config.version))) {
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