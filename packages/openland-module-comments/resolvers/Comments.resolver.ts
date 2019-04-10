import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withUser } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';
import { IDs } from '../../openland-module-api/IDs';
import { FDB } from '../../openland-module-db/FDB';

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
        comments: src => src.comments,
    },
    CommentEntry: {
        id: src => IDs.Comment.serialize(src.id),
        comment: src => src,
        parentComment: (src, args, ctx) => src.parentCommentId && FDB.Comment.findById(ctx, src.parentCommentId!),
        childComments: async (src, args, ctx) => await FDB.Comment.allFromChild(ctx, src.id)
    },

    Mutation: {
        addMessageComment: withUser(async (ctx, args, uid) => {
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            let replyToComment = args.replyComment ? IDs.Comment.parse(args.replyComment) : null;

            await Modules.Comments.addMessageComment(ctx, messageId, uid, {
                message: args.message,
                replyToComment
            });
            return true;
        }),
        editComment: withUser(async (ctx, args, uid) => {
            let commentId = IDs.Comment.parse(args.id);
            await Modules.Comments.editComment(ctx, commentId, uid, { message: args.message }, true);
            return true;
        }),

        commentReactionAdd: withUser(async (ctx, args, uid) => {
            let commentId = IDs.Comment.parse(args.commentId);
            await Modules.Comments.setReaction(ctx, commentId, uid, args.reaction, false);
            return true;
        }),
        commentReactionRemove: withUser(async (ctx, args, uid) => {
            let commentId = IDs.Comment.parse(args.commentId);
            await Modules.Comments.setReaction(ctx, commentId, uid, args.reaction, false);
            return true;
        }),
    },

    Query: {
        messageComments: withUser(async (ctx, args, uid) => {
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            return {
                comments: await FDB.Comment.allFromPeer(ctx, 'message', messageId),
                peerType: 'message',
                peerId: messageId
            };
        }),
    },
} as GQLResolver;