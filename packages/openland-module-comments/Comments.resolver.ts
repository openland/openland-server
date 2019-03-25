import { GQL, GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withUser } from '../openland-module-api/Resolvers';
import { Modules } from '../openland-modules/Modules';
import { IDs, IdsFactory } from '../openland-module-api/IDs';
import { FDB } from '../openland-module-db/FDB';
import { AppContext } from '../openland-modules/AppContext';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import CommentUpdateContainerRoot = GQLRoots.CommentUpdateContainerRoot;
import { CommentEvent } from '../openland-module-db/schema';
import { UserError } from '../openland-errors/UserError';

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
        parentComment: (src, args, ctx) => src.parentCommentId !== 0 ? FDB.Comment.findById(ctx, src.parentCommentId!) : null
    },

    Mutation: {
        addMessageComment: withUser(async (ctx, args, uid) => {
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            let replyToComment = args.replyComment ? IDs.Comment.parse(args.replyComment) : null;

            await Modules.Comments.createComment(ctx, 'message', messageId, uid, {
                message: args.message,
                replyToComment
            });
            return true;
        })
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
        commentUpdates: {
            resolve: async msg => {
                return msg;
            },
            subscribe: async function* (r: any, args: GQL.SubscriptionCommentUpdatesArgs, ctx: AppContext) {
                let uid = ctx.auth.uid;
                if (!uid) {
                    throw new AccessDeniedError();
                }
                let id = IdsFactory.resolve(args.peerId);
                let peerId: number | null;
                let peerType: string | null;

                if (id.type === IDs.ConversationMessage) {
                    peerId = id.id as number;
                    peerType = 'message';
                } else {
                    throw new UserError('Unknown peer');
                }

                let generator = FDB.CommentEvent.createUserLiveStream(ctx, peerType, peerId, 20, args.fromState || undefined);

                for await (let event of generator) {
                    yield event;
                }
            }
        }
    }
} as GQLResolver;