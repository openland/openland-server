import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { CommentPeerType } from './CommentsRepository';
import { Modules } from '../../openland-modules/Modules';
import { MessageSpan } from '../../openland-module-messaging/MessageInput';
import { NotificationInput } from '../../openland-module-notification-center/repositories/NotificationCenterRepository';
import { BetterWorkerQueue } from '../../openland-module-workers/BetterWorkerQueue';
import { batch } from '../../openland-utils/batch';

@injectable()
export class CommentsNotificationsRepository {
    private readonly queue = new BetterWorkerQueue<{ action: 'new_comment', commentId: number, uids: number[] }>(Store.CommentNotificationBatchDeliveryQueue, { type: 'transactional', maxAttempts: 'infinite' });

    async subscribeToComments(parent: Context, peerType: CommentPeerType, peerId: number, uid: number, type: 'all' | 'direct', sendEvent: boolean = true) {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.CommentsSubscription.findById(ctx, peerType, peerId, uid);
            if (existing) {
                if (existing.status !== 'active' || existing.kind !== type) {
                    existing.status = 'active';
                    existing.kind = type;
                    if (sendEvent) {
                        await Modules.NotificationCenter.onCommentPeerUpdatedForUser(ctx, uid, peerType, peerId, null);
                    }
                }
                return true;
            }
            await Store.CommentsSubscription.create(ctx, peerType, peerId, uid, { kind: type, status: 'active' });
            if (sendEvent) {
                await Modules.NotificationCenter.onCommentPeerUpdatedForUser(ctx, uid, peerType, peerId, null);
            }
            return true;
        });
    }

    async unsubscribeFromComments(parent: Context, peerType: CommentPeerType, peerId: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.CommentsSubscription.findById(ctx, peerType, peerId, uid);
            if (!existing || existing.status === 'disabled') {
                return true;
            }
            existing.status = 'disabled';
            await Modules.NotificationCenter.onCommentPeerUpdatedForUser(ctx, uid, peerType, peerId, null);
            return true;
        });
    }

    async getCommentsSubscription(parent: Context, peerType: CommentPeerType, peerId: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            return await Store.CommentsSubscription.findById(ctx, peerType, peerId, uid);
        });
    }

    async onNewComment(parent: Context, commentId: number) {
        return await inTx(parent, async (ctx) => {
            let comment = (await Store.Comment.findById(ctx, commentId))!;

            // Subscribe user if he was mentioned
            let mentions = (comment.spans || []).filter(s => s.type === 'user_mention');
            for (let mention of mentions) {
                if (mention.type !== 'user_mention') {
                    continue;
                }
                if (!(await Store.CommentsSubscription.findById(ctx, comment.peerType, comment.peerId, mention.user))) {
                    if (await this.shouldSubscribeToNotifications(parent, comment.peerType, comment.peerId, mention.user)) {
                        await this.subscribeToComments(ctx, comment.peerType, comment.peerId, mention.user, 'all');
                    }
                }
            }

            let subscriptions = await Store.CommentsSubscription.peer.findAll(ctx, comment.peerType, comment.peerId);

            // fan-out delivery
            let batches = batch(subscriptions.filter(s => s.status === 'active'), 20);
            for (let b of batches) {
                this.queue.pushWork(ctx, {
                    action: 'new_comment',
                    commentId,
                    uids: b.map(s => s.uid)
                });
            }
        });
    }

    async onNewPeer(parent: Context, peerType: CommentPeerType, peerId: number, uid: number, mentions: MessageSpan[] = []) {
        return await inTx(parent, async ctx => {
            // Subscribe to comments
            await this.subscribeToComments(ctx, peerType, peerId, uid, 'all', false);

            // Subscribe user to comments if he was mentioned
            mentions = mentions.filter(s => s.type === 'user_mention');
            for (let mention of mentions) {
                if (mention.type !== 'user_mention') {
                    continue;
                }
                if (!(await Store.CommentsSubscription.findById(ctx, peerType, peerId, mention.user))) {
                    if (await this.shouldSubscribeToNotifications(parent, peerType, peerId, mention.user)) {
                        await this.subscribeToComments(ctx, peerType, peerId, mention.user, 'all', false);
                    }
                }
            }
        });
    }

    async handleNewCommentNotificationsBatch(parent: Context, commentId: number, uids: number[]) {
        return await inTx(parent, async (ctx) => {
            let comment = (await Store.Comment.findById(ctx, commentId))!;

            let notificationsToSend: { uid: number, notificationInput: NotificationInput }[] = [];

            await Promise.all(uids.map(async uid => {
                if (comment.uid === uid) {
                    // ignore self comment
                    return;
                }

                if (comment.peerType === 'message') {
                    let message = (await Store.Message.findById(ctx, comment.peerId))!;
                    let isPublicChat = await Modules.Messaging.room.isPublicRoom(ctx, message.cid);
                    let isMember = await Modules.Messaging.room.isRoomMember(ctx, uid, message.cid);
                    let conv = await Store.Conversation.findById(ctx, message.cid);
                    if (!conv) {
                        return;
                    }

                    if (conv.kind === 'room' && !isPublicChat && !isMember) {
                        return;
                    }
                }

                let settings = await Modules.Users.getUserSettings(ctx, uid);
                let areNotificationsDisabled = false;
                if (settings.mobile && settings.desktop) {
                    areNotificationsDisabled = !settings.mobile.comments.showNotification && !settings.desktop.comments.showNotification;
                }
                if (areNotificationsDisabled) {
                    // ignore disabled notifications
                    return;
                }

                notificationsToSend.push({
                    uid: uid,
                    notificationInput: { content: [{ type: 'new_comment', commentId: comment.id }] }
                });
            }));

            for (let notification of notificationsToSend) {
                await Modules.NotificationCenter.sendNotification(ctx, notification.uid, notification.notificationInput);
            }
        });
    }

    private async shouldSubscribeToNotifications(parent: Context, peerType: CommentPeerType, peerId: number, uid: number) {
        return await inTx(parent, async ctx => {
            if (peerType === 'feed_item' || peerType === 'discussion') {
                return true;
            }

            if (peerType === 'message') {
                let message = (await Store.Message.findById(ctx, peerId))!;
                let isPublicChat = await Modules.Messaging.room.isPublicRoom(ctx, message.cid);
                let isMember = await Modules.Messaging.room.isRoomMember(ctx, uid, message.cid);

                return isPublicChat || isMember;
            }

            return false;
        });
    }
}