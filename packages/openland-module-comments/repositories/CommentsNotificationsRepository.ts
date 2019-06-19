import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { lazyInject } from '../../openland-modules/Modules.container';
import { AllEntities } from '../../openland-module-db/schema';
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
            const createEvent = async () => {
                // let sec = await this.fetchNextEventSeq(ctx, uid);
                // await this.entities.CommentEventGlobal.create(ctx, uid, sec, {
                //     kind: 'comments_peer_updated',
                //     peerType,
                //     peerId,
                // });
                await Modules.NotificationCenter.onCommentPeerUpdatedForUser(ctx, uid, peerType, peerId, null);
            };

            let existing = await this.entities.CommentsSubscription.findById(ctx, peerType, peerId, uid);
            if (existing) {
                existing.status = 'active';
                existing.kind = type;
                await createEvent();
                return true;
            }
            await this.entities.CommentsSubscription.create(ctx, peerType, peerId, uid, { kind: type, status: 'active' });
            await createEvent();
            return true;
        });
    }

    async unsubscribeFromComments(parent: Context, peerType: CommentPeerType, peerId: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await this.entities.CommentsSubscription.findById(ctx, peerType, peerId, uid);
            if (!existing || existing.status === 'disabled') {
                return true;
            }
            existing.status = 'disabled';
            await Modules.NotificationCenter.onCommentPeerUpdatedForUser(ctx, uid, peerType, peerId, null);
            // let sec = await this.fetchNextEventSeq(ctx, uid);
            // await this.entities.CommentEventGlobal.create(ctx, uid, sec, {
            //     kind: 'comments_peer_updated',
            //     peerType,
            //     peerId,
            // });
            return true;
        });
    }

    async getCommentsSubscription(parent: Context, peerType: CommentPeerType, peerId: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            return await this.entities.CommentsSubscription.findById(ctx, peerType, peerId, uid);
        });
    }

    async onNewComment(parent: Context, commentId: number) {
        return await inTx(parent, async (ctx) => {
            let comment = (await this.entities.Comment.findById(ctx, commentId))!;
            let subscriptions = await this.entities.CommentsSubscription.allFromPeer(ctx, comment.peerType, comment.peerId);
            for (let subscription of subscriptions) {
                if (subscription.status !== 'active') {
                    // ignore inactive subscription
                    continue;
                }
                if (comment.uid === subscription.uid) {
                    // ignore self comment
                    continue;
                }
                let settings = await Modules.Users.getUserSettings(ctx, subscription.uid);
                if (!settings.commentNotifications || settings.commentNotifications === 'none') {
                    // ignore disabled notifications
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

    // private async fetchNextEventSeq(parent: Context, uid: number) {
    //     return await inTx(parent, async (ctx) => {
    //         let existing = await this.entities.CommentGlobalEventSeq.findById(ctx, uid);
    //         let seq = 1;
    //         if (!existing) {
    //             await (await this.entities.CommentGlobalEventSeq.create(ctx, uid, {seq: 1})).flush(ctx);
    //         } else {
    //             seq = ++existing.seq;
    //             await existing.flush(ctx);
    //         }
    //         return seq;
    //     });
    // }
}