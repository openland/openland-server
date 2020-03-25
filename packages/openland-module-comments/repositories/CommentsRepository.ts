import { Comment } from './../../openland-module-db/store';
import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import {
    AllMentionSpan,
    BoldTextSpan,
    CodeBlockTextSpan,
    CommentAttachment, CommentAttachmentInput,
    DateTextSpan,
    InlineCodeTextSpan,
    InsaneTextSpan,
    IronyTextSpan,
    ItalicTextSpan,
    LinkSpan,
    LoudTextSpan,
    MultiUserMentionSpan,
    RoomMentionSpan,
    RotatingTextSpan,
    UserMentionSpan,
} from '../../openland-module-messaging/MessageInput';
import { createLinkifyInstance } from '../../openland-utils/createLinkifyInstance';
import * as Chrono from 'chrono-node';
import { RandomLayer } from '@openland/foundationdb-random';
import { Store } from 'openland-module-db/FDB';
import { DoubleInvokeError } from '../../openland-errors/DoubleInvokeError';
import { GQL } from '../../openland-module-api/schema/SchemaSpec';
import ImageRefInput = GQL.ImageRefInput;

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

export interface CommentInput {
    repeatKey?: string | null;
    message?: string | null;
    replyToComment?: number | null;
    spans?: CommentSpan[] | null;
    attachments?: CommentAttachmentInput[] | null;
    ignoreAugmentation?: boolean | null;
    stickerId?: string | null;

    // appends attachments instead of replacing them in editComment
    appendAttachments?: boolean | null;

    // overrides
    overrideAvatar?: ImageRefInput | null;
    overrideName?: string | null;
}

export type CommentPeerType = 'message' | 'feed_item';

@injectable()
export class CommentsRepository {

    async createComment(parent: Context, peerType: CommentPeerType, peerId: number, uid: number, commentInput: CommentInput) {
        return await inTx(parent, async (ctx) => {

            //
            // Check for duplicates
            //
            if (commentInput.repeatKey && await Store.Comment.repeat.find(ctx, peerType, peerId, commentInput.repeatKey)) {
                throw new DoubleInvokeError();
            }

            //
            // Check reply comment exists
            //
            if (commentInput.replyToComment) {
                let replyComment = await Store.Comment.findById(ctx, commentInput.replyToComment);
                if (!replyComment || replyComment.peerType !== peerType || replyComment.peerId !== peerId || replyComment.visible === false) {
                    throw new NotFoundError();
                }
            }

            //
            // Check if sticker exists
            //
            if (commentInput.stickerId) {
                let sticker = await Store.Sticker.findById(ctx, commentInput.stickerId);
                if (!sticker) {
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
            let comment = await Store.Comment.create(ctx, commentId, {
                peerId,
                peerType,
                parentCommentId: commentInput.replyToComment,
                uid,
                text: commentInput.message || null,
                spans,
                attachments,
                visible: true,
                repeatKey: commentInput.repeatKey,
                stickerId: commentInput.stickerId
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
            await Store.CommentEvent.create(ctx, peerType, peerId, eventSec, {
                uid,
                commentId,
                kind: 'comment_received'
            });

            return comment;
        });
    }

    async editComment(parent: Context, commentId: number, newComment: CommentInput, markEdited: boolean) {
        return await inTx(parent, async (ctx) => {
            let comment = await Store.Comment.findById(ctx, commentId);
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
            await Store.CommentEvent.create(ctx, comment.peerType, comment.peerId, eventSec, {
                uid: comment.uid,
                commentId,
                kind: 'comment_updated'
            });
            return comment;
        });
    }

    async deleteComment(parent: Context, commentId: number) {
        return await inTx(parent, async (ctx) => {
            let comment = await Store.Comment.findById(ctx, commentId);
            if (!comment || comment.deleted) {
                throw new NotFoundError();
            }

            comment.deleted = true;

            let childs = await Store.Comment.child.findAll(ctx, comment.id);
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
                    let parentComment: Comment | null = await Store.Comment.findById(ctx, comm.parentCommentId);

                    if (!parentComment!.deleted) {
                        break;
                    }

                    let parentChilds = await Store.Comment.child.findAll(ctx, comm.parentCommentId);

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
            await Store.CommentEvent.create(ctx, comment.peerType, comment.peerId, eventSec, {
                uid: comment.uid,
                commentId,
                kind: 'comment_updated'
            });
            return comment;
        });
    }

    async getCommentsState(parent: Context, peerType: CommentPeerType, peerId: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.CommentState.findById(ctx, peerType, peerId);
            if (existing) {
                return existing;
            } else {
                return await Store.CommentState.create(ctx, peerType, peerId, {commentsCount: 0});
            }
        });
    }

    async setReaction(parent: Context, commentId: number, uid: number, reaction: string, reset: boolean = false) {
        return await inTx(parent, async (ctx) => {
            let comment = await Store.Comment.findById(ctx, commentId);
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
            await Store.CommentEvent.create(ctx, comment.peerType, comment.peerId, eventSec, {
                uid: comment.uid,
                commentId,
                kind: 'comment_updated'
            });
            return comment;
        });
    }

    private async fetchNextCommentId(parent: Context) {
        return await inTx(parent, async (ctx) => {
            let ex = await Store.Sequence.findById(ctx, 'comment-id');
            if (ex) {
                let res = ++ex.value;
                await ex.flush(ctx);
                return res;
            } else {
                await Store.Sequence.create(ctx, 'comment-id', {value: 1});
                return 1;
            }
        });
    }

    private async fetchNextEventSeq(parent: Context, peerType: CommentPeerType, peerId: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.CommentSeq.findById(ctx, peerType, peerId);
            let seq = 1;
            if (!existing) {
                await (await Store.CommentSeq.create(ctx, peerType, peerId, {seq: 1})).flush(ctx);
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
                    id: Store.storage.db.get(RandomLayer).nextRandomId()
                });
            }

            return res;
        });
    }
}