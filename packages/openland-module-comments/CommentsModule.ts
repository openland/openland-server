import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { CommentInput } from './CommentsRepository';
import { Context } from '../openland-utils/Context';
import { CommentsMediator } from './CommentsMediator';
import { CommentAugmentationMediator } from './CommentAugmentationMediator';

@injectable()
export class CommentsModule {
    @lazyInject('CommentsMediator')
    private readonly mediator!: CommentsMediator;
    @lazyInject('CommentAugmentationMediator')
    private readonly augmentation!: CommentAugmentationMediator;

    start = () => {
        this.augmentation.start();
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
}