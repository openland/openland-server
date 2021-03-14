import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';
import { fetchNextDBSeq } from '../../openland-utils/dbSeq';
import { UserError } from '../../openland-errors/UserError';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { hasEmoji } from 'node-emoji';
import { Modules } from '../../openland-modules/Modules';
import { ModernBadge } from '../../openland-module-db/store';

export type ModernBadgeInput = {
    emoji: string
    text: string
};

@injectable()
export class ModernBadgeRepository {
    async createBadge(ctx: Context, uid: number, input: ModernBadgeInput, global: boolean = false) {
        let duplicate = await Store.ModernBadge.duplicates.find(ctx, input.emoji, input.text);
        if (duplicate) {
            if (duplicate.banned) {
                throw new UserError('This badge is banned');
            }
            return duplicate;
        }

        if (input.text.trim().length > 40) {
            throw new UserError('Invalid text length');
        }
        if (!hasEmoji(input.emoji)) {
            throw new UserError('Invalid emoji');
        }

        return await Store.ModernBadge.create(ctx, await fetchNextDBSeq(ctx, 'modern-badge-id'), {
            emoji: input.emoji,
            text: input.text,
            banned: false,
            global: global,
            creatorId: uid,
        });
    }

    /*
    * returns 'true' if badge status changed
    * returns 'false' if it is not changed
    * */
    async addBadgeToUser(ctx: Context, uid: number, bid: number) {
        let badge = await Store.ModernBadge.findById(ctx, bid);
        if (!badge || badge.banned) {
            throw new NotFoundError('Badge not found');
        }

        let userBadge = await Store.UserModernBadge.findById(ctx, uid, bid);
        let added = true;
        if (userBadge) {
            if (userBadge.deleted) {
                userBadge.deleted = false;
            } else {
                added = false;
            }
        } else {
            await Store.UserModernBadge.create(ctx, uid, bid, {
                deleted: false
            });
        }

        return {
            badge: badge,
            added: added,
        };
    }

    /*
    * returns 'true' if badge status changed
    * returns 'false' if it is not changed
    * */
    async removeBadgeFromUser(ctx: Context, uid: number, bid: number) {
        let userBadge = await Store.UserModernBadge.findById(ctx, uid, bid);

        // it does not exists, so treat as deleted
        if (!userBadge) {
            return false;
        }
        // set deleted if exists
        if (!userBadge.deleted) {
            userBadge.deleted = true;
            return true;
        }

        return false;
    }

    async findUserBadges(ctx: Context, uid: number): Promise<ModernBadge[]> {
        let bids = await Store.UserModernBadge.byUid.findAll(ctx, uid);
        let badges = await Promise.all(bids.map(async a => (await Store.ModernBadge.findById(ctx, a.bid))!));
        return badges.filter(a => !!a && !a.banned);
    }

    async searchBadges(ctx: Context, text: string | null | undefined, from: number, count: number) {
        let badges = await Modules.Search.search(ctx, {
            index: 'badges',
            body: {
                query: {
                    bool: {
                        must: [
                            { term: { global: true } },
                            { term: { banned: false } },
                            text ? {
                                match_phrase_prefix: {
                                    text: {
                                        query: text
                                    }
                                }
                            } : { match_all: {} }
                        ]
                    }
                }
            },
            size: count,
            from: from
        });

        return await Promise.all(badges.hits.hits.map(async a => (await Store.ModernBadge.findById(ctx, parseInt(a._id, 10)))!));
    }

    /* Superadmin methods */

    /*
    * returns 'true' if badge status changed
    * returns 'false' if it is not changed
    * */
    async banBadge(ctx: Context, bid: number, banned: boolean) {
        let badge = await Store.ModernBadge.findById(ctx, bid);
        if (!badge) {
            throw new NotFoundError('Badge not found');
        }

        if (badge.banned === banned) {
            return false;
        }

        badge.banned = banned;

        // Delete badge from account if it is deleted
        if (badge.banned) {
            let usersWithBadge = await Store.UserModernBadge.byBid.findAll(ctx, bid);
            for (let userBadge of usersWithBadge) {
                userBadge.deleted = true;
            }
        }

        return true;
    }
}