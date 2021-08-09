import { isContextCancelled } from '@openland/lifetime';
import { Context } from '@openland/context';
import { NotificationCenterEvent } from './../../openland-module-db/store';
import { Store } from './../../openland-module-db/FDB';
import { GQL, GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import NotificationCenterUpdateContainerRoot = GQLRoots.NotificationCenterUpdateContainerRoot;
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { Modules } from '../../openland-modules/Modules';
import UpdatedNotificationContentRoot = GQLRoots.UpdatedNotificationContentRoot;
import CommentsPeerRoot = GQLRoots.CommentsPeerRoot;

export const Resolver: GQLResolver = {
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
        state: src => src.cursor || '',
        update: src => src.items[0],
    },
    NotificationCenterUpdateBatch: {
        updates: src => src.items,
        fromSeq: src => src.items[0].seq,
        seq: src => src.items[src.items.length - 1].seq,
        state: src => src.cursor || ''
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
            } else if (obj.kind === 'notification_content_updated') {
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
        center: async (src, args, ctx) => (await Store.NotificationCenter.findById(ctx, src.ncid))!,
        notification: async (src, args, ctx) => (await Store.Notification.findById(ctx, src.notificationId!))!,
        unread: async (src, args, ctx) => await Store.NotificationCenterCounter.byId(src.ncid).get(ctx)
    },
    NotificationRead: {
        center: async (src, args, ctx) => (await Store.NotificationCenter.findById(ctx, src.ncid))!,
        unread: async (src, args, ctx) => await Store.NotificationCenterCounter.byId(src.ncid).get(ctx)
    },
    NotificationDeleted: {
        center: async (src, args, ctx) => (await Store.NotificationCenter.findById(ctx, src.ncid))!,
        notification: async (src, args, ctx) => (await Store.Notification.findById(ctx, src.notificationId!))!,
        unread: async (src, args, ctx) => await Store.NotificationCenterCounter.byId(src.ncid).get(ctx)
    },
    NotificationUpdated: {
        center: async (src, args, ctx) => (await Store.NotificationCenter.findById(ctx, src.ncid))!,
        notification: async (src, args, ctx) => (await Store.Notification.findById(ctx, src.notificationId!))!,
        unread: async (src, args, ctx) => await Store.NotificationCenterCounter.byId(src.ncid).get(ctx)
    },
    NotificationContentUpdated: {
        center: async (src, args, ctx) => (await Store.NotificationCenter.findById(ctx, src.ncid))!,
        content: async (src, args, ctx) => src.updatedContent!
    },
    UpdatedNotificationContentComment: {
        peer: async (src, args, ctx) => ({ peerType: src.peerType, peerId: src.peerId, comments: await Store.Comment.peer.findAll(ctx, src.peerType! as any, src.peerId!) } as CommentsPeerRoot),
        comment: async (src, args, ctx) => src.commentId ? (await Store.Comment.findById(ctx, src.commentId))! : null
    },

    Subscription: {
        notificationCenterUpdates: {
            resolve: async (msg, args, ctx) => {
                return {
                    cursor: msg!.cursor,
                    items: await Promise.all((msg!.items as any[]).map((v) => Store.NotificationCenterEvent.findByIdOrFail(ctx, v.ncid, v.seq)))
                } as any;
            },
            subscribe: async function* (r: any, args: GQL.SubscriptionNotificationCenterUpdatesArgs, ctx: Context) {
                let uid = ctx.auth.uid;
                if (!uid) {
                    throw new AccessDeniedError();
                }
                let center = await Modules.NotificationCenter.notificationCenterForUser(ctx, uid);

                if (isContextCancelled(ctx)) {
                    return;
                }
                const stream = Store.NotificationCenterEvent.notificationCenter.liveStream(ctx, center.id, { batchSize: 20, after: args.fromState || undefined });
                for await (let b of stream) {
                    yield { cursror: b.cursor, items: b.items.map((v) => ({ ncid: v.ncid, seq: v.seq })) } as any;
                }
            }
        }
    }

};
