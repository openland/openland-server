import { injectable } from 'inversify';
import { ModernBadgeRepository, ModernBadgeInput } from '../repositories/ModernBadgeRepository';
import { lazyInject } from 'openland-modules/Modules.container';
import { Context } from '@openland/context';
import { Modules } from '../../openland-modules/Modules';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { Store } from '../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';

@injectable()
export class ModernBadgeMediator {
    @lazyInject('ModernBadgeRepository')
    private readonly repo!: ModernBadgeRepository;

    async createBadge(parent: Context, uid: number, input: ModernBadgeInput, global: boolean = false) {
        return await inTx(parent, async ctx => {
            if (global && !await Modules.Super.isSuperAdmin(ctx, uid)) {
                throw new AccessDeniedError();
            }
            return await this.repo.createBadge(ctx, uid, input, global);
        });
    }

    async addBadgeToUser(parent: Context, uid: number, bid: number) {
        return await inTx(parent, async ctx => {
            let res = await this.repo.addBadgeToUser(ctx, uid, bid);
            await Modules.Hooks.onUserProfileUpdated(ctx, uid);
            return res;
        });
    }

    /*
    * returns 'true' if badge status changed
    * returns 'false' if it is not changed
    * */
    async removeBadgeFromUser(parent: Context, uid: number, bid: number) {
        return await inTx(parent, async ctx => {
            let res = await this.repo.removeBadgeFromUser(ctx, uid, bid);
            let profile = (await Store.UserProfile.findById(ctx, uid))!;
            if (profile.modernStatus?.type === 'badge' && profile.modernStatus.id === bid) {
                profile.modernStatus = null;
            }
            await Modules.Hooks.onUserProfileUpdated(ctx, uid);
            return res;
        });
    }

    async searchBadges(ctx: Context, text: string | null | undefined, from: number, count: number) {
        return await this.repo.searchBadges(ctx, text, from, count);
    }

    async findUserBadges(ctx: Context, uid: number) {
        return await this.repo.findUserBadges(ctx, uid);
    }

    async isBadgeAdded(ctx: Context, uid: number, bid: number) {
        let [badge, userBadge] = await Promise.all([
            Store.ModernBadge.findById(ctx, bid),
            Store.UserModernBadge.findById(ctx, uid, bid)
        ]);

        // if badge not exists or user not added
        if (!badge || !userBadge) {
            return false;
        }
        // if badge banned or user deleted badge
        if (badge.banned || userBadge.deleted) {
            return false;
        }

        // overwise it should be added
        return true;

    }

    /* Superadmin methods */

    /*
    * returns 'true' if badge status changed
    * returns 'false' if it is not changed
    * */
    async banBadge(parent: Context, uid: number, bid: number, banned: boolean) {
        return await inTx(parent, async ctx => {
            if (!await Modules.Super.isSuperAdmin(ctx, uid)) {
                throw new AccessDeniedError();
            }

            return await this.repo.banBadge(ctx, bid, banned);
        });
    }
}