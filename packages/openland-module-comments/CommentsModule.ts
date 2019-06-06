import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { CommentInput, CommentPeerType } from './CommentsRepository';
import { Context } from '@openland/context';
import { CommentsMediator } from './CommentsMediator';
import { CommentAugmentationMediator } from './CommentAugmentationMediator';
import { CommentsNotificationsMediator } from './CommentsNotificationsMediator';

@injectable()
export class CommentsModule {
    @lazyInject('CommentsMediator')
    private readonly mediator!: CommentsMediator;
    @lazyInject('CommentsNotificationsMediator')
    private readonly notificationsMediator!: CommentsNotificationsMediator;
    @lazyInject('CommentAugmentationMediator')
    private readonly augmentation!: CommentAugmentationMediator;

    start = () => {
        this.augmentation.start();
        this.notificationsMediator.start();
        // Nothing to do
    }

    async addMessageComment(ctx: Context, messageId: number, uid: number, commentInput: CommentInput) {
        return this.mediator.addMessageComment(ctx, messageId, uid, commentInput);
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

    async getNotificationsChat(ctx: Context, uid: number): Promise<number> {
        return this.notificationsMediator.getNotificationsChat(ctx, uid);
    }

    async subscribeToComments(ctx: Context, peerType: CommentPeerType, peerId: number, uid: number) {
        return this.notificationsMediator.subscribeToComments(ctx, peerType, peerId, uid);
    }
}