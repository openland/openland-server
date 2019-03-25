import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { AllEntities } from '../openland-module-db/schema';
import { Context } from '../openland-utils/Context';
import { inTx } from '../foundation-orm/inTx';

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
            // TODO: check that replyComment exists

            let commentId = await this.fetchNextCommentId(ctx);
            let comment = await this.entities.Comment.create(ctx, commentId, {
                peerId,
                peerType,
                parentCommentId: commentInput.replyToComment || 0, // 0 means root level
                uid,
                text: commentInput.message || null,
            });
            let eventSec = await this.fetchNextEventSeq(ctx, peerType, peerId);
            await this.entities.CommentEvent.create(ctx, peerType, peerId, eventSec, {
                uid,
                commentId,
                kind: 'comment_received'
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
                await this.entities.Sequence.create(ctx, 'comment-id', { value: 1 });
                return 1;
            }
        });
    }

    private async fetchNextEventSeq(parent: Context, peerType: 'message', peerId: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await this.entities.CommentSeq.findById(ctx, peerType, peerId);
            let seq = 1;
            if (!existing) {
                await (await this.entities.CommentSeq.create(ctx, peerType, peerId, { seq: 1 })).flush();
            } else {
                seq = ++existing.seq;
                await existing.flush();
            }
            return seq;
        });
    }
}