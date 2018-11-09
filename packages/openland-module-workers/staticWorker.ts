import { delay, delayBreakable, foreverBreakable } from '../openland-utils/timer';
import { LockRepository } from 'openland-module-sync/LockRepository';
import { withLogContext } from 'openland-log/withLogContext';
import { createLogger } from 'openland-log/createLogger';
import { Shutdown } from '../openland-utils/Shutdown';
import { SafeContext } from 'openland-utils/SafeContext';

const logger = createLogger('loop');

export function staticWorker(config: { name: string, version?: number, delay?: number, startDelay?: number }, worker: () => Promise<boolean>) {
    let working = true;
    let awaiter: (() => void) | undefined;
    let wasStarted = false;
    let workLoop = SafeContext.inNewContext(() => foreverBreakable(async () => {
        if (!wasStarted && config.startDelay) {
            await delay(config.startDelay);
        }
        wasStarted = true;
        let res =
            await withLogContext(['static-worker', config.name], async () => {

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
        if (!working) {
            return;
        }
        if (!res) {
            let w = delayBreakable(config.delay || 1000);
            awaiter = w.resolver;
            await w.promise;
        } else {
            await delay(100);
        }
    }));

    const shutdown = async () => {
        if (!working) {
            throw new Error('Worker already stopped');
        }
        working = false;
        if (awaiter) {
            awaiter();
            awaiter = undefined;
        }
        await workLoop.stop();
        await await LockRepository.releaseLock('worker_' + config.name, config.version);
        logger.log('worker_' + config.name, 'stopped');
    };

    Shutdown.registerWork({ name: 'worker_' + config.name, shutdown });

    return {
        shutdown
    };
}