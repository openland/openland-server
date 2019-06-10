import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withUser } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';
import { IDs } from '../../openland-module-api/IDs';
import { FDB } from '../../openland-module-db/FDB';

export default {
    NotificationCenter: {
        id: src => IDs.NotificationCenter.serialize(src.id),
        unread: (src, args, ctx) => FDB.NotificationCenterCounter.byId(src.id).get(ctx),
        state: async (src, args, ctx) => {
            let tail = await FDB.NotificationCenterEvent.createNotificationCenterStream(src.id, 1).tail(ctx);
            return {state: tail};
        },
    },

    Notification: {
        id: src => IDs.Notification.serialize(src.id),
        text: src => src.text
    },

    Query: {
        myNotificationCenter: withUser(async (ctx, args, uid) => {
            return await Modules.NotificationCenter.notificationCenterForUser(ctx, uid);
        }),
        myNotifications: withUser(async (ctx, args, uid) => {
            let center = await Modules.NotificationCenter.notificationCenterForUser(ctx, uid);
            let beforeId = args.before ? IDs.Notification.parse(args.before) : null;
            if (!args.first || args.first <= 0) {
                return [];
            }
            if (args.before && await FDB.Notification.findById(ctx, beforeId!)) {
                return await FDB.Notification.rangeFromNotificationCenterAfter(ctx, center.id, beforeId!, args.first!, true);
            }
            return await FDB.Notification.rangeFromNotificationCenter(ctx, center.id, args.first, true);
        }),
    },
    Mutation: {
        debugCreateNotification: withUser(async (ctx, args, uid) => {
            await Modules.NotificationCenter.sendNotification(ctx, IDs.User.parse(args.uid), {text: args.text});
            return true;
        }),
        readNotification: withUser(async (ctx, args, uid) => {
            await Modules.NotificationCenter.readUserNotification(ctx, IDs.Notification.parse(args.notificationId), uid);
            return await Modules.NotificationCenter.notificationCenterForUser(ctx, uid);
        }),
    }
} as GQLResolver;