import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { CommentInput, CommentsRepository } from './CommentsRepository';
import { Context } from '../openland-utils/Context';
import { inTx } from '../foundation-orm/inTx';
import { AllEntities } from '../openland-module-db/schema';
import { NotFoundError } from '../openland-errors/NotFoundError';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';

@injectable()
export class CommentsMediator {
    @lazyInject('CommentsRepository')
    private readonly repo!: CommentsRepository;
    @lazyInject('FDB')
    private readonly entities!: AllEntities;

    async addMessageComment(parent: Context, messageId: number, uid: number, commentInput: CommentInput) {
        return await inTx(parent, async (ctx) => {
            // TODO: check access
            let message = await this.entities.Message.findById(ctx, messageId);
            if (!message || message.deleted) {
                throw new NotFoundError();
            }

            return this.repo.createComment(ctx, 'message', messageId, uid, commentInput);
        });
    }

    async editComment(parent: Context, commentId: number, uid: number, newComment: CommentInput, markEdited: boolean) {
        return await inTx(parent, async (ctx) => {
            let comment = await this.entities.Comment.findById(ctx, commentId);
            if (!comment || comment.deleted) {
                throw new NotFoundError();
            }
            if (comment.uid !== uid) {
                throw new AccessDeniedError();
            }

            return this.repo.editComment(ctx, commentId, newComment, markEdited);
        });
    }

    async getMessageCommentsCount(parent: Context, messageId: number) {
        return (await this.repo.getCommentsState(parent, 'message', messageId)).commentsCount;
    }
}