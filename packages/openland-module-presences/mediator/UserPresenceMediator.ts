import { Store } from 'openland-module-db/FDB';
import { PresenceRepository } from './../repo/PresenceRepository';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';

export const LAST_SEEN_TIMEOUT = 15000;
export const LAST_SEEN_RESOLVE_TIMEOUT = 10000;

export class UserPresenceMediator {

    readonly repo: PresenceRepository = new PresenceRepository(Store.UserPresenceDirectory);

    async setOnline(parent: Context, uid: number, tid: string, platform: string, active: boolean) {
        await inTx(parent, async (ctx) => {
            let now = Date.now();
            await this.repo.setOnline(ctx, uid, now, now + LAST_SEEN_RESOLVE_TIMEOUT, active);
        });
    }

    async setOffline(parent: Context, uid: number, tid: string) {
        await inTx(parent, async (ctx) => {
            // TODO: Implement
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
        let online = (await this.repo.getOnline(ctx, uid)).lastSeen;
        if (!online) {
            return false;
        }
        if (online.timeout < now) {
            return true;
        }
        return false;
    }
}