import { IDs } from 'openland-module-api/IDs';
import { withUser, withPermission } from 'openland-module-api/Resolvers';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { Modules } from 'openland-modules/Modules';

export const Resolver: GQLResolver = {
    UserBadge: {
        id: (src) => IDs.UserBadge.serialize(src.id),
        name: (src) => src.name,
        verified: (src) => !!src.verifiedBy,
    },
    Query: {
        badgeInRoom: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.roomId);

            return await Modules.Users.getUserBadge(ctx, uid, cid, true);
        }),

        superBadgeInRoom: withPermission('super-admin', async (ctx, args) => {
            let uid = IDs.User.parse(args.userId);
            let cid = IDs.Conversation.parse(args.roomId);

            return await Modules.Users.getUserBadge(ctx, uid, cid, true);
        }),
    },
    Mutation: {
        badgeCreate: withUser(async (ctx, args, uid) => {
            await Modules.Users.createBadge(ctx, uid, args.name, false);
            return uid;
        }),
        badgeCreateToRoom: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.roomId);

            return await Modules.Users.createBadge(ctx, uid, args.name, false, cid);
        }),
        badgeSetToRoom: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.roomId);
            let bid = IDs.UserBadge.parse(args.badgeId);
            return (await Modules.Users.updateRoomBage(ctx, uid, cid, bid))!;
        }),
        badgeUnsetToRoom: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.roomId);
            await Modules.Users.updateRoomBage(ctx, uid, cid, null);
            return true;
        }),
        badgeDelete: withUser(async (ctx, args, uid) => {
            let bid = IDs.UserBadge.parse(args.badgeId);
            return await Modules.Users.deleteBadge(ctx, uid, bid);
        }),
        badgeSetPrimary: withUser(async (ctx, args, uid) => {
            let bid = IDs.UserBadge.parse(args.badgeId);
            return await Modules.Users.updatePrimaryBadge(ctx, uid, bid);
        }),
        badgeUnsetPrimary: withUser(async (ctx, args, uid) => {
            return await Modules.Users.updatePrimaryBadge(ctx, uid, null);
        }),

        // super-admin methods
        superBadgeCreate: withPermission('super-admin', async (ctx, args) => {
            let uid = IDs.User.parse(args.userId);
            await Modules.Users.createBadge(ctx, uid, args.name, true);
            return uid;
        }),
        superBadgeCreateToRoom: withPermission('super-admin', async (ctx, args) => {
            let uid = IDs.User.parse(args.userId);
            let cid = IDs.Conversation.parse(args.roomId);

            return await Modules.Users.createBadge(ctx, uid, args.name, true, cid);
        }),
        superBadgeSetToRoom: withPermission('super-admin', async (ctx, args) => {
            let uid = IDs.User.parse(args.userId);
            let cid = IDs.Conversation.parse(args.roomId);
            let bid = IDs.UserBadge.parse(args.badgeId);

            return (await Modules.Users.updateRoomBage(ctx, uid, cid, bid))!;
        }),
        superBadgeUnsetToRoom: withPermission('super-admin', async (ctx, args) => {
            let uid = IDs.User.parse(args.userId);
            let cid = IDs.Conversation.parse(args.roomId);
            await Modules.Users.updateRoomBage(ctx, uid, cid, null);
            return true;
        }),
        superBadgeDelete: withPermission('super-admin', async (ctx, args) => {
            let uid = IDs.User.parse(args.userId);
            let bid = IDs.UserBadge.parse(args.badgeId);

            return await Modules.Users.deleteBadge(ctx, uid, bid);
        }),
        superBadgeVerify: withPermission('super-admin', async (ctx, args) => {
            let by = ctx.auth.uid!;
            let bid = IDs.UserBadge.parse(args.badgeId);

            return await Modules.Users.verifyBadge(ctx, bid, by);
        }),
        superBadgeUnverify: withPermission('super-admin', async (ctx, args) => {
            let bid = IDs.UserBadge.parse(args.badgeId);

            return await Modules.Users.verifyBadge(ctx, bid, null);
        }),
    }
};
