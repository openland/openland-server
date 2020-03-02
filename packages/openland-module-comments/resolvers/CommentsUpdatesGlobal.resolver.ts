import { CommentEventGlobal } from './../../openland-module-db/store';
import { GQL, GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withUser } from '../../openland-module-api/Resolvers';
import { Store } from '../../openland-module-db/FDB';
import { AppContext } from '../../openland-modules/AppContext';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import CommentGlobalUpdateContainerRoot = GQLRoots.CommentGlobalUpdateContainerRoot;

export const Resolver: GQLResolver = {
    CommentGlobalUpdateContainer: {
        __resolveType(obj: CommentGlobalUpdateContainerRoot) {
            if (obj.items.length === 1) {
                return 'CommentGlobalUpdateSingle';
            } else {
                return 'CommentGlobalUpdateBatch';
            }
        }
    },
    CommentGlobalUpdateSingle: {
        seq: src => src.items[0].seq,
        state: src => src.cursor || '',
        update: src => src.items[0],
    },
    CommentGlobalUpdateBatch: {
        updates: src => src.items,
        fromSeq: src => src.items[0].seq,
        seq: src => src.items[src.items.length - 1].seq,
        state: src => src.cursor || ''
    },
    CommentGlobalUpdate: {
        __resolveType(obj: CommentEventGlobal) {
            if (obj.kind === 'comments_peer_updated') {
                return 'CommentPeerUpdated';
            }
            throw Error('Unknown chat update type: ' + obj.kind);
        }
    },
    CommentPeerUpdated: {
        seq: src => src.seq,
        peer: async (src, args, ctx) => ({
            peerType: src.peerType! as 'message' | 'feed_item',
            peerId: src.peerId!,
            comments: await Store.Comment.peer.findAll(ctx, src.peerType! as any, src.peerId!)
        })
    },
    Query: {
        commentGlobalUpdatesState: withUser(async (ctx, args, uid) => {
            let tail = await Store.CommentEventGlobal.user.stream(uid, { batchSize: 1 }).tail(ctx);
            return { state: tail || '' };
        })
    },
    Subscription: {
        commentUpdatesGlobal: {
            resolve: async msg => msg,
            subscribe: async (r: any, args: GQL.SubscriptionCommentUpdatesGlobalArgs, ctx: AppContext) => {
                let uid = ctx.auth.uid;
                if (!uid) {
                    throw new AccessDeniedError();
                }
                return Store.CommentEventGlobal.user.liveStream(ctx, uid, { batchSize: 20, after: args.fromState || undefined });
            }
        }
    }
};
