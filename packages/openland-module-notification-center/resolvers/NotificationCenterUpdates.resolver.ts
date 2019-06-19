import { GQL, GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import NotificationCenterUpdateContainerRoot = GQLRoots.NotificationCenterUpdateContainerRoot;
import { NotificationCenterEvent } from '../../openland-module-db/schema';
import { FDB } from '../../openland-module-db/FDB';
import { AppContext } from '../../openland-modules/AppContext';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { Modules } from '../../openland-modules/Modules';
import UpdatedNotificationContentRoot = GQLRoots.UpdatedNotificationContentRoot;

export default {
    NotificationCenterUpdateContainer: {
        __resolveType(obj: NotificationCenterUpdateContainerRoot) {
            if (obj.items.length === 1) {
                return 'NotificationCenterUpdateSingle';
            } else {
                return 'NotificationCenterUpdateBatch';
            }
        }
    },
    NotificationCenterUpdateSingle: {
        seq: src => src.items[0].seq,
        state: src => src.cursor,
        update: src => src.items[0],
    },
    NotificationCenterUpdateBatch: {
        updates: src => src.items,
        fromSeq: src => src.items[0].seq,
        seq: src => src.items[src.items.length - 1].seq,
        state: src => src.cursor
    },
    NotificationCenterUpdate: {
        __resolveType(obj: NotificationCenterEvent) {
            if (obj.kind === 'notification_received') {
                return 'NotificationReceived';
            } else if (obj.kind === 'notification_read') {
                return 'NotificationRead';
            } else if (obj.kind === 'notification_deleted') {
                return 'NotificationDeleted';
            } else if (obj.kind === 'notification_updated') {
                return 'NotificationUpdated';
            }  else if (obj.kind === 'notification_content_updated') {
                return 'NotificationContentUpdated';
            }
            throw Error('Unknown notification center update type: ' + obj.kind);
        }
    },
    UpdatedNotificationContent: {
        __resolveType(obj: UpdatedNotificationContentRoot) {
            if (obj.type === 'comment') {
                return 'UpdatedNotificationContentComment';
            }
            throw Error('Unknown UpdatedNotificationContent type: ' + obj.type);
        }
    },

    NotificationReceived: {
        center: async (src, args, ctx) => await FDB.NotificationCenter.findById(ctx, src.ncid),
        notification: async (src, args, ctx) => await FDB.Notification.findById(ctx, src.notificationId!),
        unread:  async (src, args, ctx) => await FDB.NotificationCenterCounter.byId(src.ncid).get(ctx)
    },
    NotificationRead: {
        center: async (src, args, ctx) => await FDB.NotificationCenter.findById(ctx, src.ncid),
        unread:  async (src, args, ctx) => await FDB.NotificationCenterCounter.byId(src.ncid).get(ctx)
    },
    NotificationDeleted: {
        center: async (src, args, ctx) => await FDB.NotificationCenter.findById(ctx, src.ncid),
        notification: async (src, args, ctx) => await FDB.Notification.findById(ctx, src.notificationId!),
        unread:  async (src, args, ctx) => await FDB.NotificationCenterCounter.byId(src.ncid).get(ctx)
    },
    NotificationUpdated: {
        center: async (src, args, ctx) => await FDB.NotificationCenter.findById(ctx, src.ncid),
        notification: async (src, args, ctx) => await FDB.Notification.findById(ctx, src.notificationId!),
        unread:  async (src, args, ctx) => await FDB.NotificationCenterCounter.byId(src.ncid).get(ctx)
    },
    NotificationContentUpdated: {
        center: async (src, args, ctx) => await FDB.NotificationCenter.findById(ctx, src.ncid),
        content: async (src, args, ctx) => src.updatedContent
    },
    UpdatedNotificationContentComment: {
        peer: async (src, args, ctx) => ({ peerType: src.peerType, peerId: src.peerId, comments: await FDB.Comment.allFromPeer(ctx, src.peerType! as any, src.peerId!) }),
        comment: async (src, args, ctx) => src.commentId && await FDB.Comment.findById(ctx, src.commentId)
    },

    Subscription: {
        notificationCenterUpdates: {
            resolve: async msg => {
                return msg;
            },
            subscribe: async function (r: any, args: GQL.SubscriptionNotificationCenterUpdatesArgs, ctx: AppContext) {
                let uid = ctx.auth.uid;
                if (!uid) {
                    throw new AccessDeniedError();
                }
                let center = await Modules.NotificationCenter.notificationCenterForUser(ctx, uid);

                return FDB.NotificationCenterEvent.createNotificationCenterLiveStream(ctx, center.id, 20, args.fromState || undefined);
            }
        }
    }

} as GQLResolver;