import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { AllEntities } from '../openland-module-db/schema';
import { Context } from '../openland-utils/Context';
import { inTx } from '../foundation-orm/inTx';
import { NotFoundError } from '../openland-errors/NotFoundError';
import { LinkSpan } from '../openland-module-messaging/MessageInput';
import linkify from 'linkify-it';
import tlds from 'tlds';

const linkifyInstance = linkify()
    .tlds(tlds)
    .tlds('onion', true);

export interface CommentInput {
    message?: string | null;
    replyToComment?: number | null;
}

export type CommentPeerType = 'message';

@injectable()
export class CommentsRepository {
    @lazyInject('FDB')
    private readonly entities!: AllEntities;

    async createComment(parent: Context, peerType: CommentPeerType, peerId: number, uid: number, commentInput: CommentInput) {
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
            // Parse links
            //
            let spans = [];
            let links = this.parseLinks(commentInput.message || '');
            if (links.length > 0) {
                spans.push(...links);
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
                spans
            });

            //
            // Update state
            //
            let state = await this.getCommentsState(ctx, peerType, peerId);
            console.log(state);
            state.commentsCount++;

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
            // Parse links
            //
            let spans: LinkSpan[] | null = null;

            if (newComment.message) {
                spans = [];
                let links = this.parseLinks(newComment.message || '');
                if (links.length > 0) {
                    spans.push(...links);
                }
                comment.spans = spans;
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

    async getCommentsState(parent: Context, peerType: CommentPeerType, peerId: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await this.entities.CommentState.findById(ctx, peerType, peerId);
            if (existing) {
                return existing;
            } else {
                return await this.entities.CommentState.create(ctx, peerType, peerId, { commentsCount: 0 });
            }
        });
    }

    async setReaction(parent: Context, commentId: number, uid: number, reaction: string, reset: boolean = false) {
        return await inTx(parent, async (ctx) => {
            let comment = await this.entities.Comment.findById(ctx, commentId);
            if (!comment || comment.deleted) {
                throw new NotFoundError();
            }

            //
            // Update message
            //

            let reactions = comment.reactions ? [...comment.reactions] : [];
            if (reactions.find(r => (r.userId === uid) && (r.reaction === reaction))) {
                if (reset) {
                    reactions = reactions.filter(r => !((r.userId === uid) && (r.reaction === reaction)));
                } else {
                    return;
                }
            } else {
                reactions.push({ userId: uid, reaction });
            }
            comment.reactions = reactions;

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

    private async fetchNextEventSeq(parent: Context, peerType: CommentPeerType, peerId: number) {
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

    private parseLinks(message: string): LinkSpan[] {
        let urls = linkifyInstance.match(message);

        if (!urls) {
            return [];
        }

        let offsets = new Set<number>();

        function getOffset(str: string, n: number = 0): number {
            let offset = message.indexOf(str, n);

            if (offsets.has(offset)) {
                return getOffset(str, n + 1);
            }

            offsets.add(offset);
            return offset;
        }

        return urls.map(url => ({
            type: 'link',
            offset: getOffset(url.raw),
            length: url.raw.length,
            url: url.url,
        } as LinkSpan));
    }
}