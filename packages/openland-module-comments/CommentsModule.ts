import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { CommentInput, CommentPeerType } from './repositories/CommentsRepository';
import { Context } from '@openland/context';
import { CommentsMediator } from './mediators/CommentsMediator';
import { CommentsNotificationsMediator } from './mediators/CommentsNotificationsMediator';
import { CommentAugmentationMediator } from './mediators/CommentAugmentationMediator';

@injectable()
export class CommentsModule {
    @lazyInject('CommentsMediator')
    private readonly mediator!: CommentsMediator;
    @lazyInject('CommentAugmentationMediator')
    private readonly augmentation!: CommentAugmentationMediator;
    @lazyInject('CommentsNotificationsMediator')
    readonly notificationsMediator!: CommentsNotificationsMediator;

    start = async () => {
        this.augmentation.start();
        this.notificationsMediator.start();
        // Nothing to do
    }

    async addMessageComment(ctx: Context, messageId: number, uid: number, commentInput: CommentInput) {
        return this.mediator.addMessageComment(ctx, messageId, uid, commentInput);
    }

    async addFeedItemComment(ctx: Context, feedItemId: number, uid: number, commentInput: CommentInput) {
        return this.mediator.addFeedItemComment(ctx, feedItemId, uid, commentInput);
    }

    async addDiscussionComment(ctx: Context, discussionId: number, uid: number, commentInput: CommentInput) {
        return this.mediator.addDiscussionComment(ctx, discussionId, uid, commentInput);
    }

    async editComment(ctx: Context, commentId: number, uid: number, commentInput: CommentInput, markEdited: boolean) {
        return this.mediator.editComment(ctx, commentId, uid, commentInput, markEdited);
    }

    async deleteComment(ctx: Context, commentId: number, uid: number) {
        return this.mediator.deleteComment(ctx, commentId, uid);
    }

    async getMessageCommentsCount(ctx: Context, messageId: number) {
        return this.mediator.getMessageCommentsCount(ctx, messageId);
    }

    async setReaction(ctx: Context, commentId: number, uid: number, reaction: string, reset: boolean = false) {
        return this.mediator.setReaction(ctx, commentId, uid, reaction, reset);
    }

    async subscribeToComments(ctx: Context, peerType: CommentPeerType, peerId: number, uid: number, type: 'all' | 'direct') {
        return this.notificationsMediator.subscribeToComments(ctx, peerType, peerId, uid, type);
    }

    async unsubscribeFromComments(ctx: Context, peerType: CommentPeerType, peerId: number, uid: number) {
        return this.notificationsMediator.unsubscribeFromComments(ctx, peerType, peerId, uid);
    }
}