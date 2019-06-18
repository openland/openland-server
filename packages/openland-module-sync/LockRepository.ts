import * as Crypto from 'crypto';
import { inTx } from '@openland/foundationdb';
import { FDB } from 'openland-module-db/FDB';
import { Context } from '@openland/context';

class LockRepositoryImpl {
    private lockSeed = Crypto.randomBytes(32).toString('hex');

    tryLock = async (parent: Context, key: string, version: number = 0) => {
        return inTx(parent, async (ctx) => {
            let existing = await FDB.Lock.findById(ctx, key);
            let now = Date.now();
            let currentTimeout = now + 30 * 1000;
            if (existing !== null) {
                // If current version is less than current required minimum
                if (existing.minVersion > version) {
                    return false;
                }

                if (existing.seed === this.lockSeed || existing.timeout < now) {
                    existing.seed = this.lockSeed;
                    existing.timeout = currentTimeout;
                    existing.version = version;
                    existing.minVersion = version;
                    return true;
                } else {
                    // Bump minumum version if needed
                    if (version > existing.minVersion!!) {
                        existing.minVersion = version;
                    }
                    return false;
                }
            } else {
                await FDB.Lock.create(ctx, key, { version: version, minVersion: version, seed: this.lockSeed, timeout: currentTimeout });
                return true;
            }
        });
    }

    releaseLock = async (parent: Context, key: string, version: number = 0) => {
        return inTx(parent, async (ctx) => {
            if ((await this.tryLock(ctx, key, version))) {
                let existing = await FDB.Lock.findById(ctx, key);
                if (!existing) {
                    return false;
                }

                existing.seed = this.lockSeed;
                existing.timeout = Date.now();

                return true;
            }

            return false;
        });
    }
}

export const LockRepository = new LockRepositoryImpl();