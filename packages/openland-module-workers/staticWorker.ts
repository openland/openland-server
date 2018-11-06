import { delay, foreverBreakable } from '../openland-server/utils/timer';
import { LockRepository } from 'openland-module-sync/LockRepository';
import { withLogContext } from 'openland-log/withLogContext';
import { createLogger } from 'openland-log/createLogger';

const logger = createLogger('loop');

export function staticWorker(config: { name: string, version?: number, delay?: number }, worker: () => Promise<boolean>) {
    let working = true;
    let workLoop = foreverBreakable(async () => {
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
            while (locked && working) {
                try {
                    let res2 = await worker();
                    if (!res2) {
                        locked = false;
                        return false;
                    }
                } catch (e) {
                    locked = false;
                    logger.warn(e);
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

    return {
        shutdown: async () => {
            if (!working) {
                throw new Error('Worker already stopped');
            }

            working = false;
            await workLoop.stop();
            await await LockRepository.releaseLock('worker_' + config.name, config.version);
            logger.log('worker_' + config.name, 'stopped');
        }
    };
}