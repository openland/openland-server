import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { IDs } from '../openland-module-api/IDs';
import { withUser } from './User.resolver';
import { Modules } from '../openland-modules/Modules';
import { withActivatedUser, withPermission } from '../openland-module-api/Resolvers';
import { Store } from '../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { UserError } from '../openland-errors/UserError';

export const Resolver: GQLResolver = {
    ModernBadge: {
        emoji: root => root.emoji,
        text: root => root.text,
        global: root => root.global,
        id: root => IDs.ModernBadge.serialize(root.id)
    },
    Mutation: {
        modernBadgeAdd: withActivatedUser(async (ctx, args, uid) => {
            let bid: number;
            if (args.id) {
                bid = IDs.ModernBadge.parse(args.id);
            } else if (args.input) {
                let badge = await Modules.Users.badges.createBadge(ctx, uid, args.input);
                bid = badge.id;
            } else {
                throw new UserError('Undefined input');
            }
            return await Modules.Users.badges.addBadgeToUser(ctx, uid, bid);
        }),
        modernBadgeRemove: withActivatedUser(async (ctx, args, uid) => {
            return await Modules.Users.badges.removeBadgeFromUser(ctx, uid, IDs.ModernBadge.parse(args.id));
        }),

        /* Super methods */
        globalBadgeCreate: withPermission('super-admin', async (ctx, args) => {
            return await Modules.Users.badges.createBadge(ctx, ctx.auth.uid!, args.input, true);
        }),
        superModernBadgeBan: withPermission('super-admin', async (parent, args) => {
            return await inTx(parent, async ctx => {
                return await Modules.Users.badges.banBadge(ctx, ctx.auth.uid!, IDs.ModernBadge.parse(args.id), true);
            });
        })
    },
    Query: {
        modernBadgeSearch: withActivatedUser(async (ctx, args) => {
            let from = args.after ? IDs.ModernBadgeSearchCursor.parse(args.after) : 0;
            return await Modules.Users.badges.searchBadges(ctx, args.search, from, args.first);
        }),
        modernBadgeUsers: withActivatedUser(async (ctx, args) => {
            let userBadges = await Store.UserModernBadge.byBid.findAll(ctx, IDs.ModernBadge.parse(args.bid));
            let uids = userBadges.map(a => a.uid);
            let from = 0;
            if (args.after) {
                let after = IDs.User.parse(args.after);
                from = uids.findIndex(a => a === after) + 1;
            }
            return {
                edges: uids.slice(from, from + args.first).map(a => ({ node: a, cursor: IDs.User.serialize(a) })),
                pageInfo: {
                    hasNextPage: uids.length > from + args.first,
                    hasPreviousPage: from !== 0,
                    itemsCount: userBadges.length,
                    pagesCount: Math.ceil(userBadges.length / args.first),
                    currentPage: Math.floor(from / args.first) + 1,
                    openEnded: true
                },
            };
        })
    },
    User: {
        modernBadges: withUser(async (ctx, user) => await Modules.Users.badges.findUserBadges(ctx, user.id))
    },
    Profile: {
        modernBadges: withUser(async (ctx, user) => await Modules.Users.badges.findUserBadges(ctx, user.id))
    }
};