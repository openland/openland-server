import { FDB } from 'openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';
import { UserBadge } from 'openland-module-db/schema';
import { withUser, withPermission } from 'openland-module-api/Resolvers';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';
import { Modules } from 'openland-modules/Modules';

function parseBadgeId (fromArgs: string) {
    return parseInt(IDs.UserBadge.parse(fromArgs).split('_')[0], 10);
}

export default {
    UserBadge: {
        id: (src: UserBadge) => IDs.UserBadge.serialize(src.bid + '_' + src.uid),
        name: async (src: UserBadge, args: {}, ctx: AppContext) => {
            let badge = await FDB.Badge.findById(ctx, src.bid);

            if (badge) {
                return badge.name;
            } else {
                throw new Error('Inconsistent state');
            }
        },
        verified: (src: UserBadge) => !!src.verifiedBy,
        isPrimary: async (src: UserBadge, args: {}, ctx: AppContext) => {
            let profile = await FDB.UserProfile.findById(ctx, src.uid);

            return profile && profile.primaryBadge === src.bid ? true : false;
        },
    },
    Mutation: {
        badgeCreate: withUser(async (ctx, args, uid) => {
            return await Modules.Users.createBadge(ctx, uid, args.name, false);
        }),
        badgeCreateToRoom: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.roomId);

            return await Modules.Users.createBadge(ctx, uid, args.name, false, cid);
        }),
        badgeSetToRoom: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.roomId);
            let bid = parseBadgeId(args.badgeId);

            return await Modules.Users.setRoomBage(ctx, uid, cid, bid);
        }),
        badgeUnsetToRoom: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.roomId);

            return await Modules.Users.unsetRoomBage(ctx, uid, cid);
        }),
        badgeDelete: withUser(async (ctx, args, uid) => {
            let bid = parseBadgeId(args.badgeId);

            return await Modules.Users.deleteBadge(ctx, uid, bid);
        }),
        badgeSetPrimary: withUser(async (ctx, args, uid) => {
            let bid = parseBadgeId(args.badgeId);

            return await Modules.Users.setPrimaryBadge(ctx, uid, bid);
        }),
        badgeUnsetPrimary: withUser(async (ctx, args, uid) => {
            let bid = parseBadgeId(args.badgeId);

            return await Modules.Users.unsetPrimaryBadge(ctx, uid, bid);
        }),

        // super-admin methods
        superBadgeCreate: withPermission('super-admin', async (ctx, args) => {
            let uid = IDs.User.parse(args.userId);

            return await Modules.Users.createBadge(ctx, uid, args.name, true);
        }),
        superBadgeCreateToRoom: withPermission('super-admin', async (ctx, args) => {
            let uid = IDs.User.parse(args.userId);
            let cid = IDs.Conversation.parse(args.roomId);

            return await Modules.Users.createBadge(ctx, uid, args.name, true, cid);
        }),
        superBadgeSetToRoom: withPermission('super-admin', async (ctx, args) => {
            let uid = IDs.User.parse(args.userId);
            let cid = IDs.Conversation.parse(args.roomId);
            let bid = parseBadgeId(args.badgeId);

            return await Modules.Users.setRoomBage(ctx, uid, cid, bid);
        }),
        superBadgeUnsetToRoom: withPermission('super-admin', async (ctx, args) => {
            let uid = IDs.User.parse(args.userId);
            let cid = IDs.Conversation.parse(args.roomId);

            return await Modules.Users.unsetRoomBage(ctx, uid, cid);
        }),
        superBadgeDelete: withPermission('super-admin', async (ctx, args) => {
            let uid = IDs.User.parse(args.userId);
            let bid = parseBadgeId(args.badgeId);

            return await Modules.Users.deleteBadge(ctx, uid, bid);
        }),
        superBadgeVerify: withPermission('super-admin', async (ctx, args) => {
            let suid = ctx.auth.uid!;
            let uid = IDs.User.parse(args.userId);
            let bid = parseBadgeId(args.badgeId);

            return await Modules.Users.verifyBadge(ctx, suid, uid, bid);
        }),
        superBadgeUnverify: withPermission('super-admin', async (ctx, args) => {
            let uid = IDs.User.parse(args.userId);
            let bid = parseBadgeId(args.badgeId);

            return await Modules.Users.unverifyBadge(ctx, uid, bid);
        }),
    }
} as GQLResolver;