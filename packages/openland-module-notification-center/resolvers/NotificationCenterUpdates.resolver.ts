import { GQL, GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import NotificationCenterUpdateContainerRoot = GQLRoots.NotificationCenterUpdateContainerRoot;
import { NotificationCenterEvent } from '../../openland-module-db/schema';
import { FDB } from '../../openland-module-db/FDB';
import { AppContext } from '../../openland-modules/AppContext';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { Modules } from '../../openland-modules/Modules';

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
            }
            throw Error('Unknown notification center update type: ' + obj.kind);
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