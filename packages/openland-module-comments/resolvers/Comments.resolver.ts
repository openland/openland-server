import { Store } from './../../openland-module-db/FDB';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withUser } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';
import { IDs, IdsFactory } from '../../openland-module-api/IDs';
import {
    MessageAttachmentFileInput, MessageAttachmentInput,
} from '../../openland-module-messaging/MessageInput';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { CommentSpan } from '../repositories/CommentsRepository';
import { FeedEvent, Message } from '../../openland-module-db/store';
import { resolveRichMessageCreation } from '../../openland-module-rich-message/resolvers/resolveRichMessageCreation';
import { UserError } from '../../openland-errors/UserError';

export default {
    CommentsPeer: {
        id: src => {
            if (src.peerType === 'message') {
                return IDs.CommentMessagePeer.serialize(src.peerId);
            } else if (src.peerType === 'feed_item') {
                return IDs.CommentFeedItemPeer.serialize(src.peerId);
            } else {
                throw new Error('Unknown comments peer type: ' + src.peerType);
            }
        },
        state: async (src, args, ctx) => {
            let tail = await Store.CommentEvent.user.stream(src.peerType, src.peerId).tail(ctx);
            return { state: tail };
        },
        count: src => src.comments.length,
        comments: src => src.comments,
        peerRoot: async (src, args, ctx) => {
            if (src.peerType === 'message') {
                return await Store.Message.findById(ctx, src.peerId);
            }  else if (src.peerType === 'feed_item') {
                return await Store.FeedEvent.findById(ctx, src.peerId);
            } else {
                throw new Error('Unknown comments peer type: ' + src.peerType);
            }
        },
        subscription: async (src, args, ctx) => {
            let subscription = await Store.CommentsSubscription.findById(ctx, src.peerType, src.peerId, ctx.auth.uid!);
            if (subscription && subscription.status === 'active') {
                return subscription;
            }
            return null;
        }
    },
    CommentEntry: {
        id: src => IDs.CommentEntry.serialize(src.id),
        deleted: src => src.deleted !== null ? src.deleted : false,
        comment: src => src,
        parentComment: (src, args, ctx) => src.parentCommentId && Store.Comment.findById(ctx, src.parentCommentId!),
        childComments: async (src, args, ctx) => (await Store.Comment.child.findAll(ctx, src.id)).filter(c => c.visible)
    },
    CommentPeerRoot: {
        __resolveType(obj: any) {
            if (obj instanceof Message) {
                return 'CommentPeerRootMessage';
            } else if (obj instanceof FeedEvent) {
                return 'CommentPeerRootFeedItem';
            } else {
                throw new Error('Unknown comments peer root type: ' + obj);
            }
        }
    },
    CommentPeerRootMessage: {
        message: src => src,
        chat: src => src.cid
    },
    CommentPeerRootFeedItem: {
        item: async (src, args, ctx) => src
    },
    CommentSubscription: {
        type: src => src.kind.toUpperCase()
    },

    Mutation: {
        addMessageComment: withUser(async (ctx, args, uid) => {
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            let replyToComment = args.replyComment ? IDs.Comment.parse(args.replyComment) : null;

            let spans: CommentSpan[] = [];

            //
            // Mentions
            //
            if (args.mentions) {
                let mentions: CommentSpan[] = [];

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
                    } else if (mention.all) {
                        mentions.push({
                            type: 'all_mention',
                            offset: mention.offset,
                            length: mention.length,
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

            //
            //  Spans
            //
            if (args.spans) {
                for (let span of args.spans) {
                    if (span.type === 'Bold') {
                        spans.push({ offset: span.offset, length: span.length, type: 'bold_text' });
                    } else if (span.type === 'Italic') {
                        spans.push({ offset: span.offset, length: span.length, type: 'italic_text' });
                    } else if (span.type === 'InlineCode') {
                        spans.push({ offset: span.offset, length: span.length, type: 'inline_code_text' });
                    } else if (span.type === 'CodeBlock') {
                        spans.push({ offset: span.offset, length: span.length, type: 'code_block_text' });
                    } else if (span.type === 'Irony') {
                        spans.push({ offset: span.offset, length: span.length, type: 'irony_text' });
                    } else if (span.type === 'Insane') {
                        spans.push({ offset: span.offset, length: span.length, type: 'insane_text' });
                    } else if (span.type === 'Loud') {
                        spans.push({ offset: span.offset, length: span.length, type: 'loud_text' });
                    } else if (span.type === 'Rotating') {
                        spans.push({ offset: span.offset, length: span.length, type: 'rotating_text' });
                    }
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
        betaAddMessageComment: withUser(async (ctx, args, uid) => {
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            let replyToComment = args.replyComment ? IDs.Comment.parse(args.replyComment) : null;

            return await Modules.Comments.addMessageComment(ctx, messageId, uid, {
                ...(await resolveRichMessageCreation(ctx, args)),
                replyToComment,
                repeatKey: args.repeatKey,
            });
        }),
        betaAddFeedComment: withUser(async (ctx, args, uid) => {
            let itemId = IDs.FeedItem.parse(args.feedItemId);
            let replyToComment = args.replyComment ? IDs.Comment.parse(args.replyComment) : null;

            return await Modules.Comments.addFeedItemComment(ctx, itemId, uid, {
                ...(await resolveRichMessageCreation(ctx, args)),
                replyToComment,
                repeatKey: args.repeatKey,
            });
        }),
        betaAddComment: withUser(async (ctx, args, uid) => {
            let id = IdsFactory.resolve(args.peerId);
            let peerId: number | null;
            let peerType: 'message' | 'feed_item' | null;

            if (id.type === IDs.ConversationMessage) {
                peerId = id.id as number;
                peerType = 'message';
            } else if (id.type === IDs.FeedItem) {
                peerId = id.id as number;
                peerType = 'feed_item';
            } else {
                throw new UserError('Unknown peer');
            }

            let replyToComment = args.replyComment ? IDs.Comment.parse(args.replyComment) : null;

            if (peerType === 'message') {
                return await Modules.Comments.addMessageComment(ctx, peerId, uid, {
                    ...(await resolveRichMessageCreation(ctx, args)),
                    replyToComment,
                    repeatKey: args.repeatKey,
                });
            } else if (peerType === 'feed_item') {
                return await Modules.Comments.addFeedItemComment(ctx, peerId, uid, {
                    ...(await resolveRichMessageCreation(ctx, args)),
                    replyToComment,
                    repeatKey: args.repeatKey,
                });
            } else {
                throw new UserError('Unknown peer type');
            }
        }),
        editComment: withUser(async (ctx, args, uid) => {
            let commentId = IDs.Comment.parse(args.id);
            let spans: CommentSpan[] = [];

            //
            // Mentions
            //
            if (args.mentions) {
                let mentions: CommentSpan[] = [];

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
                    } else if (mention.all) {
                        mentions.push({
                            type: 'all_mention',
                            offset: mention.offset,
                            length: mention.length,
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

            //
            //  Spans
            //
            if (args.spans) {
                for (let span of args.spans) {
                    if (span.type === 'Bold') {
                        spans.push({ offset: span.offset, length: span.length, type: 'bold_text' });
                    } else if (span.type === 'Italic') {
                        spans.push({ offset: span.offset, length: span.length, type: 'italic_text' });
                    } else if (span.type === 'InlineCode') {
                        spans.push({ offset: span.offset, length: span.length, type: 'inline_code_text' });
                    } else if (span.type === 'CodeBlock') {
                        spans.push({ offset: span.offset, length: span.length, type: 'code_block_text' });
                    } else if (span.type === 'Irony') {
                        spans.push({ offset: span.offset, length: span.length, type: 'irony_text' });
                    } else if (span.type === 'Insane') {
                        spans.push({ offset: span.offset, length: span.length, type: 'insane_text' });
                    } else if (span.type === 'Loud') {
                        spans.push({ offset: span.offset, length: span.length, type: 'loud_text' });
                    } else if (span.type === 'Rotating') {
                        spans.push({ offset: span.offset, length: span.length, type: 'rotating_text' });
                    }
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

            let comment = await Store.Comment.findById(ctx, commentId);
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
            }, false);
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

        subscribeMessageComments: withUser(async (ctx, args, uid) => {
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            await Modules.Comments.subscribeToComments(ctx, 'message', messageId, uid, args.type.toLowerCase() as any);
            return true;
        }),
        unSubscribeMessageComments: withUser(async (ctx, args, uid) => {
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            await Modules.Comments.unsubscribeFromComments(ctx, 'message', messageId, uid);
            return true;
        }),
    },

    Query: {
        messageComments: withUser(async (ctx, args, uid) => {
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            let comments = await Store.Comment.peer.findAll(ctx, 'message', messageId);

            return {
                comments: comments.filter(c => c.visible),
                peerType: 'message',
                peerId: messageId,
            };
        }),
        feedItemComments: withUser(async (ctx, args, uid) => {
            let itemId = IDs.FeedItem.parse(args.feedItemId);
            let comments = await Store.Comment.peer.findAll(ctx, 'feed_item', itemId);

            return {
                comments: comments.filter(c => c.visible),
                peerType: 'feed_item',
                peerId: itemId,
            };
        }),
        comments: withUser(async (ctx, args, uid) => {
            let id = IdsFactory.resolve(args.peerId);
            let peerId: number | null;
            let peerType: 'message' | 'feed_item' | null;

            if (id.type === IDs.ConversationMessage) {
                peerId = id.id as number;
                peerType = 'message';
            } else if (id.type === IDs.FeedItem) {
                peerId = id.id as number;
                peerType = 'feed_item';
            } else {
                throw new UserError('Unknown peer');
            }

            let comments = await Store.Comment.peer.findAll(ctx, peerType, peerId);

            return {
                comments: comments.filter(c => c.visible),
                peerType: peerType,
                peerId: peerId,
            };
        }),
    },
} as GQLResolver;