import { GQL, GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withUser } from '../openland-module-api/Resolvers';
import { Modules } from '../openland-modules/Modules';
import { IDs } from '../openland-module-api/IDs';
import { FDB } from '../openland-module-db/FDB';
import { AppContext } from '../openland-modules/AppContext';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import CommentUpdateContainerRoot = GQLRoots.CommentUpdateContainerRoot;
import { CommentEvent } from '../openland-module-db/schema';

export default {
    Comments: {
        count: src => src.length,
        comments: src => src
    },
    CommentEntry: {
        comment: src => src,
        parentComment: (src, args, ctx) => src.parentCommentId !== 0 ? FDB.Comment.findById(ctx, src.parentCommentId!) : null
    },

    Mutation: {
        addMessageComment: withUser(async (ctx, args, uid) => {
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            let replyToComment = args.replyComment ? IDs.Comment.parse(args.replyComment) : null;

            await Modules.Comments.createComment(ctx, 'message', messageId, uid, { message: args.message, replyToComment });
            return true;
        })
    },

    Query: {
        messageComments: withUser(async (ctx, args, uid) => {
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            return await FDB.Comment.allFromPeer(ctx, 'message', messageId);
        }),
        messageCommentsState: withUser(async (ctx, args, uid) => {
            let id = IDs.ConversationMessage.parse(args.messageId);
            let tail = await FDB.CommentEvent.createUserStream(ctx, 'message', id, 1).tail();
            return {
                state: tail
            };
        })
    },

    CommentUpdateContainer: {
        __resolveType(obj: CommentUpdateContainerRoot) {
            if (obj.items.length === 1) {
                return 'CommentUpdateSingle';
            } else {
                return 'CommentUpdateBatch';
            }
        }
    },
    CommentUpdateSingle: {
        seq: src => src.items[0].seq,
        state: src => src.cursor,
        update: src => src.items[0],
    },
    CommentUpdateBatch: {
        updates: src => src.items,
        fromSeq: src => src.items[0].seq,
        seq: src => src.items[src.items.length - 1].seq,
        state: src => src.cursor
    },
    CommentUpdate: {
        __resolveType(obj: CommentEvent) {
            if (obj.kind === 'comment_received') {
                return 'CommentReceived';
            }
            throw Error('Unknown chat update type: ' + obj.kind);
        }
    },
    CommentReceived: {
      comment: (src, args, ctx) => FDB.Comment.findById(ctx, src.commentId!)
    },

    Subscription: {
        messageCommentUpdates: {
            resolve: async msg => {
                return msg;
            },
            subscribe: async function * (r: any, args: GQL.SubscriptionMessageCommentUpdatesArgs, ctx: AppContext) {
                let uid = ctx.auth.uid;
                if (!uid) {
                    throw new AccessDeniedError();
                }
                let messageId = IDs.ConversationMessage.parse(args.messageId);
                let generator = FDB.CommentEvent.createUserLiveStream(ctx, 'message', messageId, 20, args.fromState || undefined);

                for await (let event of generator) {
                    yield event;
                }
            }
        }
    }
} as GQLResolver;