import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withPermission, withUser } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';
import { IDs } from '../../openland-module-api/IDs';
import { Store } from '../../openland-module-db/FDB';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import { Notification } from 'openland-module-db/store';

export default {
    NotificationCenter: {
        id: src => IDs.NotificationCenter.serialize(src.id),
        unread: (src, args, ctx) => Store.NotificationCenterCounter.byId(src.id).get(ctx),
        state: async (src, args, ctx) => {
            let tail = await Store.NotificationCenterEvent.notificationCenter.stream(src.id, { batchSize: 1 }).tail(ctx);
            return { state: tail };
        },
    },

    Notification: {
        id: src => IDs.Notification.serialize(src.id),
        text: src => src.text,
        content: src => src.content || [] ,
    },

    NotificationContent: {
        __resolveType(src: GQLRoots.NotificationContentRoot) {
            if (src.type === 'new_comment') {
                return 'NewCommentNotification';
            } if (src.type === 'new_matchmaking_profiles') {
                return 'NewMatchmakingProfilesNotification';
            } if (src.type === 'mention') {
                return 'MentionNotification';
            } else {
                throw new Error('Unknown notification content type');
            }
        }
    },
    NewCommentNotification: {
        peer: async (src, args, ctx) => {
            let comment = (await Store.Comment.findById(ctx, src.commentId))!;
            let comments = await Store.Comment.peer.findAll(ctx, comment.peerType, comment.peerId);

            return {
                comments: comments.filter(c => c.visible),
                peerType: comment.peerType,
                peerId: comment.peerId
            };
        },
        comment: async (src, args, ctx) => {
            return await Store.Comment.findById(ctx, src.commentId);
        },
    },
    NewMatchmakingProfilesNotification: {
        room: async (src, args, ctx) => {
            return await Modules.Matchmaking.getRoom(ctx, src.peerId, src.peerType);
        },
        profiles: async (src, args, ctx) => {
            let res = await Promise.all(src.uids.map(a => Modules.Matchmaking.getRoomProfile(ctx, src.peerId, src.peerType, a)));
            return res.filter(r => !!r);
        }
    },
    MentionNotification: {
        peer: async (src, args, ctx) => {
            if (src.peerType === 'room') {
                return await Store.ConversationRoom.findById(ctx, src.peerId);
            } else if (src.peerType === 'user') {
                return await Store.UserProfile.findById(ctx, src.peerId);
            } else if (src.peerType === 'organization') {
                return await Store.Organization.findById(ctx, src.peerId);
            }
            throw new Error(`invalid mention notification peer type: ${src.peerType}`);
        }
    },

    NotificationConnection: {
        items: src => src.items,
        cursor: src => src.cursor
    },

    Query: {
        myNotificationCenter: withUser(async (ctx, args, uid) => {
            return await Modules.NotificationCenter.notificationCenterForUser(ctx, uid);
        }),
        myNotifications: withUser(async (ctx, args, uid) => {
            let center = await Modules.NotificationCenter.notificationCenterForUser(ctx, uid);
            let beforeId = args.before ? IDs.Notification.parse(args.before) : null;
            if (!args.first || args.first <= 0) {
                return { items: [] };
            }
            let items: Notification[] = [];
            if (args.before && await Store.Notification.findById(ctx, beforeId!)) {
                items = (await Store.Notification.notificationCenter.query(ctx, center.id, { after: beforeId!, limit: args.first!, reverse: true })).items;
            } else {
                items = (await Store.Notification.notificationCenter.query(ctx, center.id, { limit: args.first, reverse: true })).items;
            }
            let haveMore = items.length >= args.first && (await Store.Notification.notificationCenter.query(ctx, center.id, { after: items[args.first - 1].id, limit: 1, reverse: true })).items.length > 0;

            return {
                items: items,
                cursor: haveMore ? IDs.Notification.serialize(items[args.first - 1].id) : undefined
            };
        }),
    },
    Mutation: {
        readNotification: withUser(async (ctx, args, uid) => {
            await Modules.NotificationCenter.readUserNotification(ctx, IDs.Notification.parse(args.notificationId), uid);
            return await Modules.NotificationCenter.notificationCenterForUser(ctx, uid);
        }),
        deleteNotification: withUser(async (ctx, args, uid) => {
            await Modules.NotificationCenter.deleteUserNotification(ctx, IDs.Notification.parse(args.notificationId), uid);
            return true;
        }),
        notificationCenterMarkSeqRead: withUser(async (ctx, args, uid) => {
            await Modules.NotificationCenter.markAsSeqRead(ctx, uid, args.toSeq);
            return true;
        }),
        debugCreateNotification: withPermission('super-admin', async (ctx, args) => {
            await Modules.NotificationCenter.sendNotification(ctx, IDs.User.parse(args.uid), { text: args.text });
            return true;
        }),
    }
} as GQLResolver;