import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { CommentInput } from './CommentsRepository';
import { Context } from '../openland-utils/Context';
import { CommentsMediator } from './CommentsMediator';

@injectable()
export class CommentsModule {
    @lazyInject('CommentsMediator')
    private readonly mediator!: CommentsMediator;

    start = () => {

        // Nothing to do
    }

    async addMessageComment(ctx: Context, messageId: number, uid: number, commentInput: CommentInput) {
        return this.mediator.addMessageComment(ctx, messageId, uid, commentInput);
    }

    async editComment(ctx: Context, commentId: number, uid: number, commentInput: CommentInput, markEdited: boolean) {
        return this.mediator.editComment(ctx, commentId, uid, commentInput, markEdited);
    }

    async getMessageCommentsCount(ctx: Context, messageId: number) {
        return this.mediator.getMessageCommentsCount(ctx, messageId);
    }
}