import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import FeedUpdateRoot = GQLRoots.FeedUpdateRoot;
import { AppContext } from '../../openland-modules/AppContext';
import { Modules } from '../../openland-modules/Modules';
import { PubsubSubcription } from '../../openland-module-pubsub/pubsub';
import { createIterator } from '../../openland-utils/asyncIterator';
import { Store } from '../../openland-module-db/FDB';
import { onContextCancel } from '@openland/lifetime';
import { FeedTopicEvent } from '../repositories/FeedRepository';

export default {
    FeedUpdateContainer: {
        updates: src => src.updates
    },
    FeedUpdate: {
        __resolveType(src: FeedUpdateRoot) {
            if (src.type === 'new_item') {
                return 'FeedItemReceived';
            } else if (src.type === 'edit_item') {
                return 'FeedItemUpdated';
            } else if (src.type === 'delete_item') {
                return 'FeedItemDeleted';
            }
            throw new Error('unknown feed update: ' + src);
        }
    },
    FeedItemReceived: {
        item: (src, args, ctx) => Store.FeedEvent.findById(ctx, src.id)
    },
    FeedItemUpdated: {
        item: (src, args, ctx) => Store.FeedEvent.findById(ctx, src.id)
    },
    FeedItemDeleted: {
        item: (src, args, ctx) => Store.FeedEvent.findById(ctx, src.id)
    },
    Subscription: {
        homeFeedUpdates: {
            resolve: (msg: any) => msg,
            subscribe: async function (r: any, args: {}, ctx: AppContext) {
                let uid = ctx.auth.uid!;
                let topics = await Modules.Feed.findSubscriptions(ctx, 'user-' + uid);

                let subscriptions: PubsubSubcription[] = [];
                onContextCancel(ctx, () => subscriptions.forEach(s => s.cancel()));
                let iterator = createIterator<{ updates: FeedTopicEvent[] }>(() => 0);
                for (let tid of topics) {
                    subscriptions.push(await Modules.Feed.subscribeTopicEvents(tid, event => {
                        iterator.push({ updates: [event] });
                    }));
                }
                return iterator;
            }
        }
    }
} as GQLResolver;