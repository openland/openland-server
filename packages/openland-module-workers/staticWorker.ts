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

            let locked = true;

            // Update lock loop
            // tslint:disable-next-line:no-floating-promises
            (async () => {
                while (locked) {
                    await delay(5000);
                    if (!(await LockRepository.tryLock('worker_' + config.name, config.version))) {
                        locked = false;
                        break;
                    }
                }
            })();

            // Working
            while (locked) {
                try {
                    let res2 = await worker();
                    if (!res2) {
                        locked = false;
                        return false;
                    }
                } catch (e) {
                    locked = false;
                    throw e;
                }
                await delay(100);
            }
            return true;
        });
        if (!res) {
            await delay(config.delay || 1000);
        } else {
            await delay(100);
        }
    });
}