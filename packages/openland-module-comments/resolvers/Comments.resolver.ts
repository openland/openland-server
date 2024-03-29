import { Store } from './../../openland-module-db/FDB';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withUser } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';
import { IDs, IdsFactory } from '../../openland-module-api/IDs';
import {
    CommentAttachmentInput, MessageAttachmentFileInput,
} from '../../openland-module-messaging/MessageInput';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { CommentSpan } from '../repositories/CommentsRepository';
import { Discussion, FeedEvent, Message } from '../../openland-module-db/store';
import { UserError } from '../../openland-errors/UserError';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import CommentSubscriptionTypeRoot = GQLRoots.CommentSubscriptionTypeRoot;
import { resolveCommentInput, resolveMentionsInput, resolveSpansInput } from './resolveCommentInput';
import { saveFileAttachments } from '../../openland-module-messaging/resolvers/ModernMessage.resolver';

export const Resolver: GQLResolver = {
    CommentsPeer: {
        id: src => {
            if (src.peerType === 'message') {
                return IDs.CommentMessagePeer.serialize(src.peerId);
            } else if (src.peerType === 'feed_item') {
                return IDs.CommentFeedItemPeer.serialize(src.peerId);
            } else if (src.peerType === 'discussion') {
                return IDs.CommentDiscussionPeer.serialize(src.peerId);
            } else {
                throw new Error('Unknown comments peer type: ' + src.peerType);
            }
        },
        state: async (src, args, ctx) => {
            let tail = await Store.CommentEvent.user.stream(src.peerType, src.peerId).tail(ctx);
            return { state: tail || '' };
        },
        count: src => src.comments.length,
        comments: src => src.comments,
        peerRoot: async (src, args, ctx) => {
            if (src.peerType === 'message') {
                return (await Store.Message.findById(ctx, src.peerId))!;
            } else if (src.peerType === 'feed_item') {
                return (await Store.FeedEvent.findById(ctx, src.peerId))!;
            } else if (src.peerType === 'discussion') {
                return (await Store.Discussion.findById(ctx, src.peerId))!;
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
        betaComment: src => src,
        parentComment: async (src, args, ctx) => src.parentCommentId ? (await Store.Comment.findById(ctx, src.parentCommentId!))! : null,
        childComments: async (src, args, ctx) => (await Store.Comment.child.findAll(ctx, src.id)).filter(c => c.visible)
    },
    CommentPeerRoot: {
        __resolveType(obj: any) {
            if (obj instanceof Message) {
                return 'CommentPeerRootMessage';
            } else if (obj instanceof FeedEvent) {
                return 'CommentPeerRootFeedItem';
            } else if (obj instanceof Discussion) {
                return 'CommentPeerRootPost';
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
    CommentPeerRootPost: {
        post: async (src, args, ctx) => src
    },
    CommentSubscription: {
        type: src => src.kind.toUpperCase() as CommentSubscriptionTypeRoot
    },

    Mutation: {
        betaAddComment: withUser(async (ctx, args, uid) => {
            let id = IdsFactory.resolve(args.peerId);
            let peerId: number | null;
            let peerType: 'message' | 'feed_item' | 'discussion' | null;

            if (id.type === IDs.ConversationMessage) {
                peerId = id.id as number;
                peerType = 'message';
            } else if (id.type === IDs.FeedItem) {
                peerId = id.id as number;
                peerType = 'feed_item';
            } else if (id.type === IDs.Discussion) {
                peerId = id.id as number;
                peerType = 'discussion';
            } else {
                throw new UserError('Unknown peer');
            }

            let replyToComment = args.replyComment ? IDs.Comment.parse(args.replyComment) : null;

            if (peerType === 'message') {
                return await Modules.Comments.addMessageComment(ctx, peerId, uid, {
                    ...(await resolveCommentInput(ctx, args)),
                    replyToComment,
                    repeatKey: args.repeatKey,
                });
            } else if (peerType === 'feed_item') {
                return await Modules.Comments.addFeedItemComment(ctx, peerId, uid, {
                    ...(await resolveCommentInput(ctx, args)),
                    replyToComment,
                    repeatKey: args.repeatKey,
                });
            } else if (peerType === 'discussion') {
                return await Modules.Comments.addDiscussionComment(ctx, peerId, uid, {
                    ...(await resolveCommentInput(ctx, args)),
                    replyToComment,
                    repeatKey: args.repeatKey,
                });
            } else {
                throw new UserError('Unknown peer type');
            }
        }),
        betaAddStickerComment: withUser(async (ctx, args, uid) => {
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
                    replyToComment,
                    stickerId: IDs.Sticker.parse(args.stickerId),
                    repeatKey: args.repeatKey,
                });
            } else if (peerType === 'feed_item') {
                return await Modules.Comments.addFeedItemComment(ctx, peerId, uid, {
                    replyToComment,
                    stickerId: IDs.Sticker.parse(args.stickerId),
                    repeatKey: args.repeatKey,
                });
            } else {
                throw new UserError('Unknown peer type');
            }
        }),
        editComment: withUser(async (ctx, args, uid) => {
            let commentId = IDs.Comment.parse(args.id);
            let spans: CommentSpan[] = [
                ...resolveSpansInput(args.spans || []),
                ...resolveMentionsInput(args.mentions || [])
            ];

            //
            // File attachments
            //
            let attachments: MessageAttachmentFileInput[] = [];
            if (args.fileAttachments) {
                attachments = await saveFileAttachments(ctx, args.fileAttachments);
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

            let newAttachments: CommentAttachmentInput[] = [];

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

        subscribeToComments: withUser(async (ctx, args, uid) => {
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

            await Modules.Comments.subscribeToComments(ctx, peerType, peerId, uid, args.type.toLowerCase() as any);
            return true;
        }),
        unsubscribeFromComments: withUser(async (ctx, args, uid) => {
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

            await Modules.Comments.unsubscribeFromComments(ctx, peerType, peerId, uid);
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
        postComments: withUser(async (ctx, args, uid) => {
            let discussionId = IDs.Discussion.parse(args.postId);
            let comments = await Store.Comment.peer.findAll(ctx, 'discussion', discussionId);

            return {
                comments: comments.filter(c => c.visible),
                peerType: 'feed_item',
                peerId: discussionId,
            };
        }),
        comments: withUser(async (ctx, args, uid) => {
            let id = IdsFactory.resolve(args.peerId);
            let peerId: number | null;
            let peerType: 'message' | 'feed_item' | 'discussion' | null;

            if (id.type === IDs.ConversationMessage) {
                peerId = id.id as number;
                peerType = 'message';
            } else if (id.type === IDs.FeedItem) {
                peerId = id.id as number;
                peerType = 'feed_item';
            } else if (id.type === IDs.Discussion) {
                peerId = id.id as number;
                peerType = 'discussion';
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
        commentEntry: withUser(async (ctx, args, uid) => {
            let commentId = IDs.CommentEntry.parse(args.entryId);
            let comment = await Store.Comment.findById(ctx, commentId);
            if (comment && comment.visible && !comment.deleted) {
                return comment;
            }
            return null;
        }),
    },
};
