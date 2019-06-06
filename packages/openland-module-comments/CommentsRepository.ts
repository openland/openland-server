import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { AllEntities, Comment } from '../openland-module-db/schema';
import { Context } from '@openland/context';
import { inTx } from '../foundation-orm/inTx';
import { NotFoundError } from '../openland-errors/NotFoundError';
import {
    AllMentionSpan,
    BoldTextSpan, CodeBlockTextSpan, DateTextSpan, InlineCodeTextSpan, InsaneTextSpan, IronyTextSpan, ItalicTextSpan,
    LinkSpan, LoudTextSpan, MessageAttachmentFile, MessageAttachmentFileInput, MessageRichAttachment, MessageRichAttachmentInput,
    MultiUserMentionSpan,
    RoomMentionSpan, RotatingTextSpan,
    UserMentionSpan
} from '../openland-module-messaging/MessageInput';
import { createLinkifyInstance } from '../openland-utils/createLinkifyInstance';
import * as Chrono from 'chrono-node';

const linkifyInstance = createLinkifyInstance();

export type CommentSpan =
    UserMentionSpan |
    MultiUserMentionSpan |
    RoomMentionSpan |
    LinkSpan |
    BoldTextSpan |
    ItalicTextSpan |
    IronyTextSpan |
    InlineCodeTextSpan |
    CodeBlockTextSpan |
    InsaneTextSpan |
    LoudTextSpan |
    RotatingTextSpan |
    DateTextSpan |
    AllMentionSpan;

export type CommentAttachmentInput = MessageAttachmentFileInput | MessageRichAttachmentInput;
export type CommentAttachment = MessageAttachmentFile | MessageRichAttachment;

export interface CommentInput {
    message?: string | null;
    replyToComment?: number | null;
    spans?: CommentSpan[] | null;
    attachments?: CommentAttachmentInput[] | null;
    ignoreAugmentation?: boolean | null;

    // appends attachments instead of replacing them in editComment
    appendAttachments?: boolean | null;
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
                if (!replyComment || replyComment.peerType !== peerType || replyComment.peerId !== peerId || replyComment.visible === false) {
                    throw new NotFoundError();
                }
            }

            //
            // Parse links
            //
            let spans = commentInput.spans ? [...commentInput.spans] : [];
            let links = this.parseLinks(commentInput.message || '');
            if (links.length > 0) {
                spans.push(...links);
            }
            //
            // Parse dates
            //
            let dates = this.parseDates(commentInput.message || '');
            if (dates.length > 0) {
                spans.push(...dates);
            }

            //
            // Prepare attachments
            //
            let attachments: CommentAttachment[] = await this.prepateAttachments(ctx, commentInput.attachments || []);

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
                spans,
                attachments,
                visible: true
            });

            //
            // Update state
            //
            let state = await this.getCommentsState(ctx, peerType, peerId);
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

            let spans: CommentSpan[] | null = null;

            if (newComment.message) {
                spans = newComment.spans ? [...newComment.spans] : [];
                //
                // Parse links
                //
                let links = this.parseLinks(newComment.message || '');
                if (links.length > 0) {
                    spans.push(...links);
                }
                //
                // Parse dates
                //
                let dates = this.parseDates(newComment.message || '');
                if (dates.length > 0) {
                    spans.push(...dates);
                }
                comment.spans = spans;
            }

            //
            //  Update comment
            //
            if (newComment.message) {
                comment.text = newComment.message;
            }
            if (newComment.attachments) {
                if (newComment.appendAttachments) {
                    comment.attachments = [...(comment.attachments || []), ...await this.prepateAttachments(ctx, newComment.attachments || [])];
                } else {
                    comment.attachments = await this.prepateAttachments(ctx, newComment.attachments || []);
                }
            }
            if (markEdited) {
                comment.edited = true;
            }
            await comment.flush(ctx);

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

    async deleteComment(parent: Context, commentId: number) {
        return await inTx(parent, async (ctx) => {
            let comment = await this.entities.Comment.findById(ctx, commentId);
            if (!comment || comment.deleted) {
                throw new NotFoundError();
            }

            comment.deleted = true;

            let childs = await this.entities.Comment.allFromChild(ctx, comment.id);
            let numberOfCommentsMarkedInvisible = 0;

            // Mark visible if comment have visible sub-comments
            if (childs.find(c => c.visible || false)) {
                comment.visible = true;
                await comment.flush(ctx);
            } else {
                comment.visible = false;
                numberOfCommentsMarkedInvisible++;
                await comment.flush(ctx);
            }

            // Handle parent visibility if we are not visible anymore
            if (!comment.visible && comment.parentCommentId) {
                let comm: Comment | undefined = comment;
                while (comm && comm.parentCommentId) {
                    let parentComment: Comment | null = await this.entities.Comment.findById(ctx, comm.parentCommentId);

                    if (!parentComment!.deleted) {
                        break;
                    }

                    let parentChilds = await this.entities.Comment.allFromChild(ctx, comm.parentCommentId);

                    if (!parentChilds.find(c => c.id !== comment!.id && (c.visible || false))) {
                        parentComment!.visible = false;
                        numberOfCommentsMarkedInvisible++;
                        await parentComment!.flush(ctx);
                        comm = parentComment!;
                    } else {
                        break;
                    }
                }
            }

            //
            // Update state
            //
            let state = await this.getCommentsState(ctx, comment.peerType, comment.peerId);
            state.commentsCount -= numberOfCommentsMarkedInvisible;

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
                return await this.entities.CommentState.create(ctx, peerType, peerId, {commentsCount: 0});
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
                reactions.push({userId: uid, reaction});
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
                await ex.flush(ctx);
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
                await (await this.entities.CommentSeq.create(ctx, peerType, peerId, {seq: 1})).flush(ctx);
            } else {
                seq = ++existing.seq;
                await existing.flush(ctx);
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

    private parseDates(message: string): DateTextSpan[] {
        let parsed = Chrono.parse(message, new Date());

        return parsed.map(part => {
            return {
                type: 'date_text',
                offset: part.index,
                length: part.text.length,
                date: part.start.date().getTime()
            };
        });
    }

    private async prepateAttachments(parent: Context, attachments: CommentAttachmentInput[]) {
        return await inTx(parent, async (ctx) => {
            let res: CommentAttachment[] = [];

            for (let attachInput of attachments) {
                res.push({
                    ...attachInput,
                    id: this.entities.connection.nextRandomId()
                });
            }

            return res;
        });
    }
}