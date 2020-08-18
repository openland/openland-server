import { Store } from 'openland-module-db/FDB';
import { PresenceRepository } from './../repo/PresenceRepository';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';

export class UserPresenceMediator {

    readonly repo: PresenceRepository = new PresenceRepository(Store.UserOnlineDirectory);

    async setOnline(parent: Context, uid: number, tid: string, platform: string, active: boolean, timeout: number) {
        await inTx(parent, async (ctx) => {
            let now = Date.now();
            await this.repo.setOnline(ctx, uid, tid, now, now + timeout, active);
        });
    }

    async setOffline(parent: Context, uid: number, tid: string) {
        await inTx(parent, async (ctx) => {
            let now = Date.now();
            await this.repo.setOffline(ctx, uid, tid, now);
        });
    }

    async getStatus(ctx: Context, uid: number): Promise<'online' | 'never_online' | number> {
        let now = Date.now();
        let online = (await this.repo.getOnline(ctx, uid)).lastSeen;
        if (!online) {
            return 'never_online';
        }
        if (online.timeout < now) {
            return 'online';
        }
        return online.date;
    }

    async isActive(ctx: Context, uid: number): Promise<boolean> {
        let now = Date.now();
        let online = (await this.repo.getOnline(ctx, uid)).lastActive;
        if (!online) {
            return false;
        }
        if (online.timeout < now) {
            return true;
        }
        return false;
    }
}