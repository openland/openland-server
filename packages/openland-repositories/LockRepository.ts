import * as Crypto from 'crypto';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';

class LockRepositoryImpl {
    private lockSeed = Crypto.randomBytes(32).toString('hex');

    tryLock = async (key: string, version: number = 0) => {
        return inTx(async () => {
            let existing = await FDB.Lock.findById(key);
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
                FDB.Lock.createOrUpdate(key, { version: version, minVersion: version, seed: this.lockSeed, timeout: currentTimeout });
                return true;
            }
        });
    }
}

export const LockRepository = new LockRepositoryImpl();