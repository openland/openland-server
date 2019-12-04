import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { lazyInject } from '../../openland-modules/Modules.container';
import { CommentInput, CommentsRepository } from '../repositories/CommentsRepository';
import { Context } from '@openland/context';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { Modules } from '../../openland-modules/Modules';
import { CommentAugmentationMediator } from './CommentAugmentationMediator';
import { CommentsNotificationsMediator } from './CommentsNotificationsMediator';
import { Store } from 'openland-module-db/FDB';

@injectable()
export class CommentsMediator {
    @lazyInject('CommentsRepository')
    private readonly repo!: CommentsRepository;
    @lazyInject('CommentAugmentationMediator')
    private readonly augmentation!: CommentAugmentationMediator;
    @lazyInject('CommentsNotificationsMediator')
    private readonly notificationsMediator!: CommentsNotificationsMediator;

    async addMessageComment(parent: Context, messageId: number, uid: number, commentInput: CommentInput) {
        return await inTx(parent, async (ctx) => {
            // TODO: check access
            let message = await Store.Message.findById(ctx, messageId);
            if (!message || message.deleted) {
                throw new NotFoundError();
            }

            //
            // Create comment
            //
            let res = await this.repo.createComment(ctx, 'message', messageId, uid, commentInput);

            //
            //  Subscribe to notifications
            //
            await this.notificationsMediator.subscribeToComments(ctx, 'message', messageId, uid, 'all');
            // for old comments
            // TODO: make migration instead
            let sub = await Store.CommentsSubscription.findById(ctx, 'message', messageId, message.uid);
            if (!sub) {
                await this.notificationsMediator.subscribeToComments(ctx, 'message', messageId, message.uid, 'all');
            }

            //
            // Send notifications
            //
            await this.notificationsMediator.onNewComment(ctx, res);

            //
            // Send message updated event
            //
            await Modules.Messaging.markMessageUpdated(ctx, message.id);

            //
            //  Track event
            //
            await Modules.Metrics.onCommentCreated(ctx, message, res);

            if (!commentInput.ignoreAugmentation) {
                await this.augmentation.onNewComment(ctx, res);
            }

            return res;
        });
    }

    async addFeedItemComment(parent: Context, feedItemId: number, uid: number, commentInput: CommentInput) {
        return await inTx(parent, async (ctx) => {
            // TODO: check access
            let item = await Store.FeedEvent.findById(ctx, feedItemId);
            if (!item) {
                throw new NotFoundError();
            }

            //
            // Allow overrides only for super admins
            //
            if (commentInput.overrideAvatar || commentInput.overrideName) {
                let permissions = await Modules.Super.resolvePermissions(ctx, { uid: uid, oid: null });
                if (!permissions.has('super-admin')) {
                    commentInput.overrideName = null;
                    commentInput.overrideAvatar = null;
                }
            }

            //
            // Create comment
            //
            let res = await this.repo.createComment(ctx, 'feed_item', feedItemId, uid, commentInput);

            //
            //  Subscribe to notifications
            //
            await this.notificationsMediator.subscribeToComments(ctx, 'feed_item', feedItemId, uid, 'all');

            //
            // Send notifications
            //
            await this.notificationsMediator.onNewComment(ctx, res);

            //
            // Send feed item updated event
            //
            await Modules.Feed.deliverFeedItemUpdated(ctx, item.id);

            if (!commentInput.ignoreAugmentation) {
                await this.augmentation.onNewComment(ctx, res);
            }

            return res;
        });
    }

    async editComment(parent: Context, commentId: number, uid: number, newComment: CommentInput, markEdited: boolean) {
        return await inTx(parent, async (ctx) => {
            let comment = await Store.Comment.findById(ctx, commentId);
            if (!comment || comment.deleted) {
                throw new NotFoundError();
            }
            if (comment.uid !== uid) {
                throw new AccessDeniedError();
            }
            let res = this.repo.editComment(ctx, commentId, newComment, markEdited);

            if (!newComment.ignoreAugmentation) {
                await this.augmentation.onCommentUpdated(ctx, comment);
            }

            // Send notification center updates
            await Modules.NotificationCenter.onCommentPeerUpdated(ctx, comment.peerType, comment.peerId, comment.id);

            return res;
        });
    }

    async deleteComment(parent: Context, commentId: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            let comment = await Store.Comment.findById(ctx, commentId);
            if (!comment || comment.deleted) {
                throw new NotFoundError();
            }
            let haveSpecialRights = false;

            if (comment.peerType === 'message') {
                let message = await Store.Message.findById(ctx, comment.peerId);
                if (message) {
                    haveSpecialRights = await Modules.Messaging.room.canEditRoom(ctx, message.cid, uid);
                }
            }

            if (comment.uid !== uid && !((await Modules.Super.superRole(ctx, uid)) === 'super-admin') && !haveSpecialRights) {
                throw new AccessDeniedError();
            }

            let res = this.repo.deleteComment(ctx, commentId);

            if (comment.peerType === 'message') {
                let message = await Store.Message.findById(ctx, comment.peerId);

                if (message) {
                    //
                    // Send message updated event
                    //
                    await Modules.Messaging.markMessageUpdated(ctx, message.id);
                }
            }

            // Send notification center updates
            await Modules.NotificationCenter.onCommentPeerUpdated(ctx, comment.peerType, comment.peerId, comment.id);

            return res;
        });
    }

    async getMessageCommentsCount(parent: Context, messageId: number) {
        return (await this.repo.getCommentsState(parent, 'message', messageId)).commentsCount;
    }

    async setReaction(parent: Context, commentId: number, uid: number, reaction: string, reset: boolean = false) {
        return this.repo.setReaction(parent, commentId, uid, reaction, reset);
    }
}