import { forever, delay } from '../openland-server/utils/timer';
import { LockRepository } from 'openland-module-sync/LockRepository';
import { withLogContext } from 'openland-log/withLogContext';

export function staticWorker(config: { name: string, version?: number, delay?: number }, worker: () => Promise<boolean>) {
    forever(async () => {
        let res = await withLogContext(['static-worker', config.name], async () => {
            // Locking
            if (!(await LockRepository.tryLock('worker_' + config.name, config.version))) {
                return false;
            }
            // Working
            return await worker();
        });
        if (!res) {
            await delay(config.delay || 1000);
        } else {
            await delay(100);
        }
    });
}