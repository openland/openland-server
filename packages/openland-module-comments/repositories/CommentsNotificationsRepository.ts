import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { lazyInject } from '../../openland-modules/Modules.container';
import { AllEntities, Message } from '../../openland-module-db/schema';
import { Context } from '@openland/context';
import { CommentPeerType } from './CommentsRepository';
import { Modules } from '../../openland-modules/Modules';

@injectable()
export class CommentsNotificationsRepository {
    @lazyInject('FDB')
    private readonly entities!: AllEntities;
    @lazyInject('UserStateRepository')

    async subscribeToComments(parent: Context, peerType: CommentPeerType, peerId: number, uid: number, type: 'all' | 'direct') {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.CommentsSubscription.findById(ctx, peerType, peerId, uid);
            if (existing) {
                if (existing.status !== 'active' || existing.kind !== type) {
                    existing.status = 'active';
                    existing.kind = type;
                    await Modules.NotificationCenter.onCommentPeerUpdatedForUser(ctx, uid, peerType, peerId, null);
                }
                return true;
            }
            await Store.CommentsSubscription.create(ctx, peerType, peerId, uid, { kind: type, status: 'active' });
            await Modules.NotificationCenter.onCommentPeerUpdatedForUser(ctx, uid, peerType, peerId, null);
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
            let comment = (await this.entities.Comment.findById(ctx, commentId))!;

            // Subscribe user if he was mentioned
            let mentions = (comment.spans || []).filter(s => s.type === 'user_mention');
            for (let mention of mentions) {
                if (mention.type !== 'user_mention') {
                    continue;
                }
                if (!(await Store.CommentsSubscription.findById(ctx, comment.peerType, comment.peerId, mention.user))) {
                    await this.subscribeToComments(ctx, comment.peerType, comment.peerId, mention.user, 'all');
                }
            }

            let subscriptions = await Store.CommentsSubscription.peer.findAll(ctx, comment.peerType, comment.peerId);
            for (let subscription of subscriptions) {
                if (comment.uid === subscription.uid) {
                    // ignore self comment
                    continue;
                }
                let settings = await Modules.Users.getUserSettings(ctx, subscription.uid);
                if (!settings.commentNotifications || settings.commentNotifications === 'none') {
                    // ignore disabled notifications
                    continue;
                }
                if (subscription.status !== 'active') {
                    // ignore inactive subscription
                    continue;
                }

                let sendNotification = false;

                if (settings.commentNotifications === 'all') {
                    sendNotification = true;
                } else if (settings.commentNotifications === 'direct') {
                    if (comment.parentCommentId) {
                        let parentComment = await this.entities.Comment.findById(ctx, comment.parentCommentId);
                        if (parentComment && parentComment.uid === subscription.uid) {
                            sendNotification = true;
                        }
                    }
                    if (comment.peerType === 'message') {
                        let message = await this.entities.Message.findById(ctx, comment.peerId);
                        if (message && message.uid === subscription.uid) {
                            sendNotification = true;
                        }
                    }
                }
                if (sendNotification) {
                    await Modules.NotificationCenter.sendNotification(ctx, subscription.uid, { content: [{ type: 'new_comment', commentId: comment.id }] });
                }
            }
        });
    }

    async onNewMessage(parent: Context, message: Message) {
        return await inTx(parent, async (ctx) => {
            // Subscribe message sender creator to comments
            await this.subscribeToComments(ctx, 'message', message.id, message.uid, 'all');

            // Subscribe user to comments if he was mentioned
            let mentions = (message.spans || []).filter(s => s.type === 'user_mention');
            for (let mention of mentions) {
                if (mention.type !== 'user_mention') {
                    continue;
                }
                if (!(await Store.CommentsSubscription.findById(ctx, 'message', message.id, mention.user))) {
                    await this.subscribeToComments(ctx, 'message', message.id, mention.user, 'all');
                }
            }
        });
    }
}