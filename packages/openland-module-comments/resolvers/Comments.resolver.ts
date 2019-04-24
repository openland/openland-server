import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withUser } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';
import { IDs } from '../../openland-module-api/IDs';
import { FDB } from '../../openland-module-db/FDB';
import {
    MessageAttachmentFileInput, MessageAttachmentInput,
    MessageSpan
} from '../../openland-module-messaging/MessageInput';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { Comment } from '../../openland-module-db/schema';

export default {
    CommentsPeer: {
        id: src => {
            if (src.peerType === 'message') {
                return IDs.ConversationMessage.serialize(src.peerId);
            } else {
                throw new Error('Unknown comments peer type: ' + src.peerType);
            }
        },
        state: async (src, args, ctx) => {
            let tail = await FDB.CommentEvent.createUserStream(ctx, src.peerType, src.peerId, 1).tail();
            return {state: tail};
        },
        count: src => src.comments.length,
        comments: src => src.comments.map(c => ({ comment: c, showComment: src.showComment })),
    },
    CommentEntry: {
        id: src => IDs.Comment.serialize(src.comment.id),
        deleted: src => src.comment.deleted !== null ? src.comment.deleted : false,
        comment: src => src.comment,
        parentComment: async (src, args, ctx) => src.comment.parentCommentId ? { comment: await FDB.Comment.findById(ctx, src.comment.parentCommentId!), showComment: src.showComment } : null,
        childComments: async (src, args, ctx) => (await FDB.Comment.allFromChild(ctx, src.comment.id)).filter(c => !c.deleted || (c.deleted && src.showComment(c.id))).map(c => ({ comment: c, showComment: src.showComment }))
    },

    Mutation: {
        addMessageComment: withUser(async (ctx, args, uid) => {
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            let replyToComment = args.replyComment ? IDs.Comment.parse(args.replyComment) : null;

            let spans: MessageSpan[] = [];

            //
            // Mentions
            //
            if (args.mentions) {
                let mentions: MessageSpan[] = [];

                for (let mention of args.mentions) {
                    if (mention.userId) {
                        mentions.push({
                            type: 'user_mention',
                            offset: mention.offset,
                            length: mention.length,
                            user: IDs.User.parse(mention.userId!)
                        });
                    } else if (mention.chatId) {
                        mentions.push({
                            type: 'room_mention',
                            offset: mention.offset,
                            length: mention.length,
                            room: IDs.Conversation.parse(mention.chatId!)
                        });
                    } else if (mention.userIds) {
                        mentions.push({
                            type: 'multi_user_mention',
                            offset: mention.offset,
                            length: mention.length,
                            users: mention.userIds.map(id => IDs.User.parse(id))
                        });
                    }
                }

                spans.push(...mentions);
            }

            //
            // File attachments
            //
            let attachments: MessageAttachmentFileInput[] = [];
            if (args.fileAttachments) {
                for (let fileInput of args.fileAttachments) {
                    let fileMetadata = await Modules.Media.saveFile(ctx, fileInput.fileId);
                    let filePreview: string | null = null;

                    if (fileMetadata.isImage) {
                        filePreview = await Modules.Media.fetchLowResPreview(ctx, fileInput.fileId);
                    }

                    attachments.push({
                        type: 'file_attachment',
                        fileId: fileInput.fileId,
                        fileMetadata: fileMetadata || null,
                        filePreview: filePreview || null
                    });
                }
            }

            await Modules.Comments.addMessageComment(ctx, messageId, uid, {
                message: args.message,
                replyToComment,
                attachments,
                spans
            });
            return true;
        }),
        editComment: withUser(async (ctx, args, uid) => {
            let commentId = IDs.Comment.parse(args.id);
            let spans: MessageSpan[] = [];

            //
            // Mentions
            //
            if (args.mentions) {
                let mentions: MessageSpan[] = [];

                for (let mention of args.mentions) {
                    if (mention.userId) {
                        mentions.push({
                            type: 'user_mention',
                            offset: mention.offset,
                            length: mention.length,
                            user: IDs.User.parse(mention.userId!)
                        });
                    } else if (mention.chatId) {
                        mentions.push({
                            type: 'room_mention',
                            offset: mention.offset,
                            length: mention.length,
                            room: IDs.Conversation.parse(mention.chatId!)
                        });
                    } else if (mention.userIds) {
                        mentions.push({
                            type: 'multi_user_mention',
                            offset: mention.offset,
                            length: mention.length,
                            users: mention.userIds.map(id => IDs.User.parse(id))
                        });
                    }
                }

                spans.push(...mentions);
            }

            //
            // File attachments
            //
            let attachments: MessageAttachmentFileInput[] = [];
            if (args.fileAttachments) {
                for (let fileInput of args.fileAttachments) {
                    let fileMetadata = await Modules.Media.saveFile(ctx, fileInput.fileId);
                    let filePreview: string | null = null;

                    if (fileMetadata.isImage) {
                        filePreview = await Modules.Media.fetchLowResPreview(ctx, fileInput.fileId);
                    }

                    attachments.push({
                        type: 'file_attachment',
                        fileId: fileInput.fileId,
                        fileMetadata: fileMetadata || null,
                        filePreview: filePreview || null
                    });
                }
            }

            await Modules.Comments.editComment(ctx, commentId, uid, {
                message: args.message,
                spans,
                attachments
            }, true);
            return true;
        }),
        deleteComment: withUser(async (ctx, args, uid) => {
            let commentId = IDs.Comment.parse(args.id);
            await Modules.Comments.deleteComment(ctx, commentId, uid);
            return true;
        }),
        deleteCommentAugmentation: withUser(async (ctx, args, uid) => {
            let commentId = IDs.Comment.parse(args.id);

            let comment = await FDB.Comment.findById(ctx, commentId);
            if (!comment || comment.deleted) {
                throw new NotFoundError();
            }

            let newAttachments: MessageAttachmentInput[] = [];

            if (comment.attachments) {
                newAttachments = comment.attachments.filter(a => a.type !== 'rich_attachment').map(a => {
                    delete a.id;
                    return a;
                });
            }

            await Modules.Comments.editComment(ctx, commentId, uid, {
                attachments: newAttachments,
                ignoreAugmentation: true,
            }, true);
            return true;
        }),

        commentReactionAdd: withUser(async (ctx, args, uid) => {
            let commentId = IDs.Comment.parse(args.commentId);
            await Modules.Comments.setReaction(ctx, commentId, uid, args.reaction, false);
            return true;
        }),
        commentReactionRemove: withUser(async (ctx, args, uid) => {
            let commentId = IDs.Comment.parse(args.commentId);
            await Modules.Comments.setReaction(ctx, commentId, uid, args.reaction, true);
            return true;
        }),
    },

    Query: {
        messageComments: withUser(async (ctx, args, uid) => {
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            let comments = await FDB.Comment.allFromPeer(ctx, 'message', messageId);

            let id2Comment = new Map<number, Comment>();
            for (let comment of comments) {
                id2Comment.set(comment.id, comment);
            }

            let commentVisible = new Map<number, boolean>();

            for (let comment of comments) {
                if (comment.deleted) {
                    continue;
                }

                commentVisible.set(comment.id, true);
                let c: Comment|undefined = comment;
                while (c && c.parentCommentId) {
                    if (commentVisible.get(c.parentCommentId)) {
                        break;
                    }

                    commentVisible.set(c.parentCommentId, true);
                    c = id2Comment.get(c.parentCommentId);
                }
            }

            let res = comments.filter(c => commentVisible.get(c.id));

            return {
                comments: res,
                peerType: 'message',
                peerId: messageId,
                showComment: (id: number) => commentVisible.get(id) || false
            };
        }),
    },
} as GQLResolver;