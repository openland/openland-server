import { Store } from 'openland-module-db/FDB';
import { PresenceRepository } from './../repo/PresenceRepository';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';

export const LAST_SEEN_TIMEOUT = 15000;
export const LAST_SEEN_RESOLVE_IMEOUT = 10000;

export class UserPresenceMediator {

    readonly repo: PresenceRepository = new PresenceRepository(Store.UserPresenceDirectory);

    async setOnline(parent: Context, uid: number, tid: string, timeout: number, platform: string, active: boolean) {
        await inTx(parent, async (ctx) => {
            return this.repo.setOnline(ctx, uid, Date.now(), active);
        });
    }

    async getLastSeen(ctx: Context, uid: number): Promise<'online' | 'never_online' | number> {
        let now = Date.now();
        let online = (await this.repo.getOnline(ctx, uid)).lastSeen;
        if (!online) {
            return 'never_online';
        }
        if (now < online + LAST_SEEN_RESOLVE_IMEOUT) {
            return 'online';
        }
        return online;
    }

    async isActive(ctx: Context, uid: number): Promise<boolean> {
        let now = Date.now();
        let online = (await this.repo.getOnline(ctx, uid)).lastSeen;
        if (!online) {
            return false;
        }
        if (now < online + LAST_SEEN_RESOLVE_IMEOUT) {
            return true;
        }
        return false;
    }
}