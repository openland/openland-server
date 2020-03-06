import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from '../openland-module-db/FDB';

class PersistenceThrottle {
    private service: string;

    constructor(service: string) {
        this.service = service;
    }

    async onFire(parent: Context, key: string) {
        return inTx(parent, async ctx => {
            let throttle = await this.getThrottleRecord(ctx, key);
            throttle.firedCount += 1;
            throttle.lastFireTime = Math.floor(Date.now() / 1000);
            await throttle.flush(ctx);
        });
    }

    async nextFireTimeout(parent: Context, key: string) {
        return inTx(parent, async ctx => {
            let throttle = await this.getThrottleRecord(ctx, key);
            if (throttle.lastFireTime === 0 || throttle.firedCount === 0) {
                return 0;
            }
            let timeout = throttle.firedCount * 5;
            let now = Math.floor(Date.now() / 1000);
            let nextTime = throttle.lastFireTime + timeout;
            if (now > nextTime) {
                return 0;
            } else {
                return nextTime;
            }
        });
    }

    async release(parent: Context, key: string) {
        return inTx(parent, async ctx => {
            let throttle = await this.getThrottleRecord(ctx, key);
            throttle.firedCount = 0;
            throttle.lastFireTime = 0;
            await throttle.flush(ctx);
        });
    }

    private getThrottleRecord(parent: Context, key: string) {
        return inTx(parent, async ctx => {
            let throttle = await Store.ServiceThrottle.findById(ctx, this.service, key);
            if (!throttle) {
                return await Store.ServiceThrottle.create(ctx, this.service, key, { lastFireTime: 0, firedCount: 0 });
            }
            return throttle;
        });
    }
}

export function createPersistenceThrottle(service: string) {
    return new PersistenceThrottle(service);
}
