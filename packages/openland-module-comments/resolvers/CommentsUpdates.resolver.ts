import { Context } from '@openland/context';
import { CommentEvent } from './../../openland-module-db/store';
import { GQL, GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { Store } from '../../openland-module-db/FDB';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { IDs, IdsFactory } from '../../openland-module-api/IDs';
import { UserError } from '../../openland-errors/UserError';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import CommentUpdateContainerRoot = GQLRoots.CommentUpdateContainerRoot;

export const Resolver: GQLResolver = {
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
        state: src => src.cursor || '',
        update: src => src.items[0],
    },
    CommentUpdateBatch: {
        updates: src => src.items,
        fromSeq: src => src.items[0].seq,
        seq: src => src.items[src.items.length - 1].seq,
        state: src => src.cursor || ''
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
        comment: async (src, args, ctx) => (await Store.Comment.findById(ctx, src.commentId!))!,
        repeatKey: async (src, args, ctx) => (await Store.Comment.findById(ctx, src.commentId!))!.repeatKey,
    },
    CommentUpdated: {
        comment: async (src, args, ctx) => (await Store.Comment.findById(ctx, src.commentId!))!
    },

    Subscription: {
        commentUpdates: {
            resolve: async msg => {
                return msg;
            },
            subscribe: async function* (r: any, args: GQL.SubscriptionCommentUpdatesArgs, ctx: Context) {
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
                } else if (id.type === IDs.FeedItem) {
                    peerId = id.id as number;
                    peerType = 'feed_item';
                } else if (id.type === IDs.Discussion) {
                    peerId = id.id as number;
                    peerType = 'discussion';
                } else {
                    throw new UserError('Unknown peer');
                }

                let generator = Store.CommentEvent.user.liveStream(ctx, peerType, peerId, { batchSize: 20, after: args.fromState || undefined });
                for await (let event of generator) {
                    yield event;
                }
            }
        }
    }
};
