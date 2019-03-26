import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { AllEntities } from '../openland-module-db/schema';
import { Context } from '../openland-utils/Context';
import { inTx } from '../foundation-orm/inTx';
import { NotFoundError } from '../openland-errors/NotFoundError';

export interface CommentInput {
    message?: string | null;
    replyToComment?: number | null;
}

@injectable()
export class CommentsRepository {
    @lazyInject('FDB')
    private readonly entities!: AllEntities;

    async createComment(parent: Context, peerType: 'message', peerId: number, uid: number, commentInput: CommentInput) {
        return await inTx(parent, async (ctx) => {
            //
            // Check reply comment exists
            //
            if (commentInput.replyToComment) {
                let replyComment = await this.entities.Comment.findById(ctx, commentInput.replyToComment);
                if (!replyComment || replyComment.deleted || replyComment.peerType !== peerType || replyComment.peerId !== peerId) {
                    throw new NotFoundError();
                }
            }

            //
            //  Create comment
            //
            let commentId = await this.fetchNextCommentId(ctx);
            let comment = await this.entities.Comment.create(ctx, commentId, {
                peerId,
                peerType,
                parentCommentId: commentInput.replyToComment,
                uid,
                text: commentInput.message || null,
            });

            //
            // Create event
            //
            let eventSec = await this.fetchNextEventSeq(ctx, peerType, peerId);
            await this.entities.CommentEvent.create(ctx, peerType, peerId, eventSec, {
                uid,
                commentId,
                kind: 'comment_received'
            });

            return comment;
        });
    }

    async editComment(parent: Context, commentId: number, newComment: CommentInput, markEdited: boolean) {
        return await inTx(parent, async (ctx) => {
            let comment = await this.entities.Comment.findById(ctx, commentId);
            if (!comment || comment.deleted) {
                throw new NotFoundError();
            }

            //
            //  Update comment
            //
            if (newComment.message) {
                comment.text = newComment.message;
            }
            if (markEdited) {
                comment.edited = true;
            }

            //
            // Create event
            //
            let eventSec = await this.fetchNextEventSeq(ctx, comment.peerType, comment.peerId);
            await this.entities.CommentEvent.create(ctx, comment.peerType, comment.peerId, eventSec, {
                uid: comment.uid,
                commentId,
                kind: 'comment_updated'
            });
            return comment;
        });
    }

    private async fetchNextCommentId(parent: Context) {
        return await inTx(parent, async (ctx) => {
            let ex = await this.entities.Sequence.findById(ctx, 'comment-id');
            if (ex) {
                let res = ++ex.value;
                await ex.flush();
                return res;
            } else {
                await this.entities.Sequence.create(ctx, 'comment-id', {value: 1});
                return 1;
            }
        });
    }

    private async fetchNextEventSeq(parent: Context, peerType: 'message', peerId: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await this.entities.CommentSeq.findById(ctx, peerType, peerId);
            let seq = 1;
            if (!existing) {
                await (await this.entities.CommentSeq.create(ctx, peerType, peerId, {seq: 1})).flush();
            } else {
                seq = ++existing.seq;
                await existing.flush();
            }
            return seq;
        });
    }
}