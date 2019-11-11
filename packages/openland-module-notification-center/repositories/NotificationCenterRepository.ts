import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { fetchNextDBSeq } from '../../openland-utils/dbSeq';
import { CommentPeerType } from '../../openland-module-comments/repositories/CommentsRepository';
import { Store } from 'openland-module-db/FDB';
import { MatchmakingPeerType } from '../../openland-module-matchmaking/repositories/MatchmakingRepository';

export type NotificationContent = NewCommentNotification | NewMatchmakingProfileNotification | MentionNotification;

export type NewCommentNotification = {
    type: 'new_comment';
    commentId: number;
};

export type NewMatchmakingProfileNotification = {
    type: 'new_matchmaking_profiles';
    peerId: number;
    peerType: MatchmakingPeerType;
    uids: number[];
};

export type MentionNotification = {
    type: 'mention';
    peerId: number;
    peerType: 'user' | 'organization' | 'room';
};

export interface NotificationInput {
    text?: string | null;
    content?: NotificationContent[] | null;
}

@injectable()
export class NotificationCenterRepository {

    async createNotification(parent: Context, ncid: number, notificationInput: NotificationInput) {
        return await inTx(parent, async (ctx) => {
            //
            // Create notification
            //
            let nid = await this.fetchNotificationId(ctx);
            let notification = await Store.Notification.create(ctx, nid, {
                ncid,
                text: notificationInput.text,
                content: notificationInput.content
            });

            //
            // Update counter
            //
            let counter = await Store.NotificationCenterCounter.byId(ncid);
            await counter.increment(ctx);

            //
            // Create Event
            //
            let seq = await this.nextEventSeq(ctx, ncid);
            await Store.NotificationCenterEvent.create(ctx, ncid, seq, {
                kind: 'notification_received',
                notificationId: notification.id
            });

            return notification;
        });
    }

    async readNotification(parent: Context, nid: number) {
        return await inTx(parent, async (ctx) => {
            let notification = await Store.Notification.findById(ctx, nid);
            if (!notification) {
                throw new NotFoundError();
            }

            let state = await this.getNotificationState(ctx, notification.ncid);

            if (!state.readNotificationId || state.readNotificationId < notification.id) {
                state.readNotificationId = notification.id;

                let counter = await Store.NotificationCenterCounter.byId(notification.ncid);
                let remaining = (await Store.Notification.notificationCenter.query(ctx, notification.ncid, { after: notification.id })).items;
                let remainingCount = remaining.length;
                let delta: number;
                let localUnread = await Store.NotificationCenterCounter.get(ctx, notification.ncid);
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
                    await Store.NotificationCenterEvent.create(ctx, notification.ncid, seq, {
                        kind: 'notification_read',
                    });
                }
            }
        });
    }

    async deleteNotification(parent: Context, nid: number) {
        return await inTx(parent, async (ctx) => {
            let notification = await Store.Notification.findById(ctx, nid);
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
            await Store.NotificationCenterEvent.create(ctx, notification.ncid, seq, {
                kind: 'notification_deleted',
                notificationId: notification.id
            });

            //
            // Update counter
            //
            let state = await this.getNotificationState(ctx, notification.ncid);

            if (!state.readNotificationId || notification.id > state.readNotificationId) {
                let counter = await Store.NotificationCenterCounter.byId(notification.ncid);
                counter.decrement(ctx);
            }
        });
    }

    async notificationCenterForUser(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.UserNotificationCenter.user.find(ctx, uid);
            if (existing) {
                return existing;
            }
            let ncid = await this.fetchNotificationCenterId(ctx);
            await Store.NotificationCenter.create(ctx, ncid, { kind: 'user' });
            return await Store.UserNotificationCenter.create(ctx, ncid, { uid });
        });
    }

    async getNotificationState(parent: Context, ncid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.NotificationCenterState.findById(ctx, ncid);
            if (existing) {
                return existing;
            }
            return await Store.NotificationCenterState.create(ctx, ncid, { seq: 1 });
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
            let notification = await Store.Notification.findById(ctx, nid);
            if (!notification) {
                throw new NotFoundError();
            }
            //
            // Create event
            //
            let seq = await this.nextEventSeq(ctx, notification.ncid);
            await Store.NotificationCenterEvent.create(ctx, notification.ncid, seq, {
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
            await Store.NotificationCenterEvent.create(ctx, ncid, seq, {
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