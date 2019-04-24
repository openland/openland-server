import { GQL, GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { CommentEvent } from '../../openland-module-db/schema';
import { FDB } from '../../openland-module-db/FDB';
import { AppContext } from '../../openland-modules/AppContext';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { IDs, IdsFactory } from '../../openland-module-api/IDs';
import { UserError } from '../../openland-errors/UserError';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import CommentUpdateContainerRoot = GQLRoots.CommentUpdateContainerRoot;

export default {
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
            } else if (obj.kind === 'comment_updated') {
                return 'CommentUpdated';
            }
            throw Error('Unknown chat update type: ' + obj.kind);
        }
    },
    CommentReceived: {
        comment: (src, args, ctx) => FDB.Comment.findById(ctx, src.commentId!)
    },
    CommentUpdated: {
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