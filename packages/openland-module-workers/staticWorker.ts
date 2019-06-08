import { delay, delayBreakable, foreverBreakable } from '../openland-utils/timer';
import { LockRepository } from 'openland-module-sync/LockRepository';
import { createLogger } from 'openland-log/createLogger';
import { Shutdown } from '../openland-utils/Shutdown';
import { Context, createNamedContext } from '@openland/context';
import { withLogContext } from 'openland-log/withLogContext';
import { randomGlobalInviteKey } from 'openland-utils/random';

const logger = createLogger('loop');

export function staticWorker(config: { name: string, version?: number, delay?: number, startDelay?: number }, worker: (ctx: Context) => Promise<boolean>) {
    let working = true;
    let awaiter: (() => void) | undefined;
    let wasStarted = false;
    let ctx = createNamedContext('worker-' + config.name);
    let workLoop = foreverBreakable(async () => {
        if (!wasStarted && config.startDelay) {
            await delay(config.startDelay);
        }
        wasStarted = true;
        let res = await (async () => {

            let lockCtx = withLogContext(ctx, ['lock-' + randomGlobalInviteKey(3)]);

            // Locking
            if (!(await LockRepository.tryLock(lockCtx, 'worker_' + config.name, config.version))) {
                logger.log(lockCtx, 'lock-failed-start');
                return false;
            }
            logger.log(lockCtx, 'lock-acquired-start');

            let locked = true;

            // Update lock loop
            // tslint:disable-next-line:no-floating-promises
            (async () => {
                while (locked) {
                    if (!(await LockRepository.tryLock(lockCtx, 'worker_' + config.name, config.version))) {
                        logger.log(lockCtx, 'lock-failed');
                        locked = false;
                        break;
                    }
                    logger.log(lockCtx, 'lock-acquired');
                    await delay(5000);
                }
            })();

            // Working
            while (locked && working) {
                try {
                    let res2 = await worker(ctx);
                    if (!res2) {
                        logger.log(lockCtx, 'unlock');
                        locked = false;
                        return false;
                    }
                } catch (e) {
                    logger.log(lockCtx, 'unlock');
                    locked = false;
                    logger.warn(ctx, e);
                    throw e;
                }
                await delay(100);
            }
            return true;
        })();
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
    });

    const shutdown = async (sctx: Context) => {
        if (!working) {
            throw new Error('Worker already stopped');
        }
        working = false;
        if (awaiter) {
            awaiter();
            awaiter = undefined;
        }
        await workLoop.stop();
        await await LockRepository.releaseLock(ctx, 'worker_' + config.name, config.version);
        logger.log(sctx, 'worker_' + config.name, 'stopped');
    };

    Shutdown.registerWork({ name: 'worker_' + config.name, shutdown });

    return {
        shutdown
    };
}