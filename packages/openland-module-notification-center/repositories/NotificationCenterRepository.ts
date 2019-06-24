import { Store } from './../../openland-module-db/store';
import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { AllEntities } from '../../openland-module-db/schema';
import { Context } from '@openland/context';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { fetchNextDBSeq } from '../../openland-utils/dbSeq';
import { CommentPeerType } from '../../openland-module-comments/repositories/CommentsRepository';

export type NotificationContent = NewCommentNotification;

export type NewCommentNotification = {
    type: 'new_comment'
    commentId: number;
};

export interface NotificationInput {
    text?: string | null;
    content?: NotificationContent[] | null;
}

@injectable()
export class NotificationCenterRepository {
    @lazyInject('FDB')
    private readonly fdb!: AllEntities;

    @lazyInject('Store')
    private readonly store!: Store;

    async createNotification(parent: Context, ncid: number, notificationInput: NotificationInput) {
        return await inTx(parent, async (ctx) => {
            //
            // Create notification
            //
            let nid = await this.fetchNotificationId(ctx);
            let notification = await this.fdb.Notification.create(ctx, nid, {
                ncid,
                text: notificationInput.text,
                content: notificationInput.content
            });

            //
            // Update counter
            //
            let counter = await this.store.NotificationCenterCounter.byId(ncid);
            await counter.increment(ctx);

            //
            // Create Event
            //
            let seq = await this.nextEventSeq(ctx, ncid);
            await this.fdb.NotificationCenterEvent.create(ctx, ncid, seq, {
                kind: 'notification_received',
                notificationId: notification.id
            });

            return notification;
        });
    }

    async readNotification(parent: Context, nid: number) {
        return await inTx(parent, async (ctx) => {
            let notification = await this.fdb.Notification.findById(ctx, nid);
            if (!notification) {
                throw new NotFoundError();
            }

            let state = await this.getNotificationState(ctx, notification.ncid);

            if (!state.readNotificationId || state.readNotificationId < notification.id) {
                state.readNotificationId = notification.id;

                let counter = await this.store.NotificationCenterCounter.byId(notification.ncid);
                let remaining = (await this.fdb.Notification.allFromNotificationCenterAfter(ctx, notification.ncid, notification.id));
                let remainingCount = remaining.length;
                let delta: number;
                let localUnread = await this.store.NotificationCenterCounter.byId(notification.ncid).get(ctx);
                if (remainingCount === 0) { // Just additional case for self-healing of a broken counters
                    delta = -localUnread;
                } else {
                    delta = -(localUnread - remainingCount);
                }
                // Crazy hack to avoid -0 values
                if (delta === 0) {
                    delta = 0;
                }

                // Update counter
                if (delta !== 0) {
                    counter.add(ctx, delta);
                }

                // Create event
                if (delta !== 0) {
                    let seq = await this.nextEventSeq(ctx, notification.ncid);
                    await this.fdb.NotificationCenterEvent.create(ctx, notification.ncid, seq, {
                        kind: 'notification_read',
                    });
                }
            }
        });
    }

    async deleteNotification(parent: Context, nid: number) {
        return await inTx(parent, async (ctx) => {
            let notification = await this.fdb.Notification.findById(ctx, nid);
            if (!notification || notification.deleted) {
                throw new NotFoundError();
            }

            //
            // Delete notification
            //
            notification.deleted = true;

            //
            // Create event
            //
            let seq = await this.nextEventSeq(ctx, notification.ncid);
            await this.fdb.NotificationCenterEvent.create(ctx, notification.ncid, seq, {
                kind: 'notification_deleted',
                notificationId: notification.id
            });

            //
            // Update counter
            //
            let state = await this.getNotificationState(ctx, notification.ncid);

            if (!state.readNotificationId || notification.id > state.readNotificationId) {
                let counter = await this.store.NotificationCenterCounter.byId(notification.ncid);
                counter.decrement(ctx);
            }
        });
    }

    async notificationCenterForUser(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await this.fdb.UserNotificationCenter.findFromUser(ctx, uid);
            if (existing) {
                return existing;
            }
            let ncid = await this.fetchNotificationCenterId(ctx);
            await this.fdb.NotificationCenter.create(ctx, ncid, {kind: 'user'});
            return await this.fdb.UserNotificationCenter.create(ctx, ncid, {uid});
        });
    }

    async getNotificationState(parent: Context, ncid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await this.fdb.NotificationCenterState.findById(ctx, ncid);
            if (existing) {
                return existing;
            }
            return await this.fdb.NotificationCenterState.create(ctx, ncid, {seq: 1});
        });
    }

    async markAsSeqRead(parent: Context, ncid: number, toSeq: number) {
        await inTx(parent, async (ctx) => {
            let state = await this.getNotificationState(ctx, ncid);
            if (toSeq > state.seq) {
                state.readSeq = state.seq;
            } else {
                state.readSeq = toSeq;
            }
            await state.flush(ctx);
        });
    }

    async markNotificationAsUpdated(parent: Context, nid: number) {
        await inTx(parent, async (ctx) => {
            let notification = await this.fdb.Notification.findById(ctx, nid);
            if (!notification) {
                throw new NotFoundError();
            }
            //
            // Create event
            //
            let seq = await this.nextEventSeq(ctx, notification.ncid);
            await this.fdb.NotificationCenterEvent.create(ctx, notification.ncid, seq, {
                kind: 'notification_updated',
                notificationId: notification.id
            });
        });
    }

    async onCommentPeerUpdated(parent: Context, ncid: number, peerType: CommentPeerType, peerId: number, commentId: number | null) {
        await inTx(parent, async (ctx) => {
            //
            // Create event
            //
            let seq = await this.nextEventSeq(ctx, ncid);
            await this.fdb.NotificationCenterEvent.create(ctx, ncid, seq, {
                kind: 'notification_content_updated',
                updatedContent: {
                    type: 'comment',
                    peerId,
                    peerType,
                    commentId
                }
            });
        });
    }

    private async fetchNotificationId(parent: Context) {
        return fetchNextDBSeq(parent, 'notification-id');
    }

    private async fetchNotificationCenterId(parent: Context) {
        return fetchNextDBSeq(parent, 'notification-center-id');
    }

    private async nextEventSeq(parent: Context, ncid: number) {
        return await inTx(parent, async (ctx) => {
            let state = await this.getNotificationState(ctx, ncid);
            state.seq++;
            await state.flush(ctx);
            return state.seq;
        });
    }
}