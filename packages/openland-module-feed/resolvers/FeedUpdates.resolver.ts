import { GQL, GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import FeedUpdateRoot = GQLRoots.FeedUpdateRoot;
import { AppContext } from '../../openland-modules/AppContext';
import { Modules } from '../../openland-modules/Modules';
import { Store } from '../../openland-module-db/FDB';
import { FeedItemDeletedEvent, FeedItemReceivedEvent, FeedItemUpdatedEvent } from '../../openland-module-db/store';
import { IDs } from '../../openland-module-api/IDs';

export default {
    FeedUpdateContainer: {
        updates: src => src.items,
        state: src => IDs.FeedUpdatesCursor.serialize(src.cursor || '')
    },
    FeedUpdate: {
        __resolveType(src: FeedUpdateRoot) {
            if (src instanceof FeedItemReceivedEvent) {
                return 'FeedItemReceived';
            } else if (src instanceof FeedItemUpdatedEvent) {
                return 'FeedItemUpdated';
            } else if (src instanceof FeedItemDeletedEvent) {
                return 'FeedItemDeleted';
            } else {
                throw new Error('unknown feed update: ' + src);
            }
        }
    },
    FeedItemReceived: {
        item: (src, args, ctx) => Store.FeedEvent.findById(ctx, src.itemId)
    },
    FeedItemUpdated: {
        item: (src, args, ctx) => Store.FeedEvent.findById(ctx, src.itemId)
    },
    FeedItemDeleted: {
        item: (src, args, ctx) => Store.FeedEvent.findById(ctx, src.itemId)
    },
    Subscription: {
        homeFeedUpdates: {
            resolve: (msg: any) => msg,
            subscribe: async function (r: any, args: GQL.SubscriptionHomeFeedUpdatesArgs, ctx: AppContext) {
                let uid = ctx.auth.uid!;
                let subscriber = await Modules.Feed.resolveSubscriber(ctx, 'user-' + uid);
                return await Store.FeedEventStore.createLiveStream(ctx, subscriber.id, { after: args.fromState ? IDs.FeedUpdatesCursor.parse(args.fromState) : undefined });
            }
        }
    }
} as GQLResolver;