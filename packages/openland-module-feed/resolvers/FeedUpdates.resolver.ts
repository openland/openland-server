import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import FeedUpdateRoot = GQLRoots.FeedUpdateRoot;
import { AppContext } from '../../openland-modules/AppContext';
import { Modules } from '../../openland-modules/Modules';
import { PubsubSubcription } from '../../openland-module-pubsub/pubsub';
import { createIterator } from '../../openland-utils/asyncIterator';
import FeedUpdate = GQLRoots.FeedUpdate;
import { Store } from '../../openland-module-db/FDB';

export default {
    FeedUpdateContainer: {
        updates: src => src.updates
    },
    FeedUpdate: {
        __resolveType(src: FeedUpdateRoot) {
            if (src.type === 'new_item') {
                return 'ItemReceived';
            }
            throw new Error('unknown feed update: ' + src);
        }
    },
    ItemReceived: {
        post: (src, args, ctx) => Store.FeedEvent.findById(ctx, src.id)
    },
    Subscription: {
        homeFeedUpdates: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (r: any, args: {}, ctx: AppContext) {
                let uid = ctx.auth.uid!;
                let topics = await Modules.Feed.findSubscriptions(ctx, 'user-' + uid);

                let subscriptions: PubsubSubcription[] = [];
                let iterator = createIterator<{ updates: FeedUpdate[] }>(() => subscriptions.forEach(s => s.cancel()));
                for (let tid of topics) {
                    subscriptions.push(await Modules.Feed.subscribeTopic(tid, event => {
                        iterator.push({ updates: [{ type: 'new_item', id: event.id }] });
                    }));
                }
                return iterator;
            }
        }
    }
} as GQLResolver;