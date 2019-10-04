import { GQL, GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import FeedUpdateRoot = GQLRoots.FeedUpdateRoot;
import { AppContext } from '../../openland-modules/AppContext';
import { Modules } from '../../openland-modules/Modules';
import { Store } from '../../openland-module-db/FDB';
import { FeedItemDeletedEvent, FeedItemReceivedEvent, FeedItemUpdatedEvent } from '../../openland-module-db/store';
import { IDs } from '../../openland-module-api/IDs';
import { createIterator } from '../../openland-utils/asyncIterator';
import { BaseEvent, LiveStreamItem } from '@openland/foundationdb-entity';

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
                await Modules.Feed.subscribe(ctx, 'user-' + uid, 'tag-global');
                let subscriber = await Modules.Feed.resolveSubscriber(ctx, 'user-' + uid);
                let working = true;

                let userCursor: undefined|string;
                let globalCursor: undefined|string;

                if (args.fromState) {
                    let state = IDs.FeedUpdatesCursor.parse(args.fromState);
                    if (state.includes(':')) {
                        userCursor = state.split(':')[0]!;
                        globalCursor = state.split(':')[1]!;
                    } else {
                        userCursor = args.fromState;
                    }
                }
                let userStream = Store.FeedEventStore.createLiveStream(ctx, subscriber.id, { after: userCursor });
                let globalStream = Store.FeedGlobalEventStore.createLiveStream(ctx, { after: globalCursor });
                let iterator = createIterator<LiveStreamItem<BaseEvent>>(() => working = false);

                let lastUserCursor: null|string = userCursor || await Store.FeedEventStore.createStream(subscriber.id, { after: userCursor }).tail(ctx);
                let lastGlobalCursor: null|string = globalCursor || await Store.FeedGlobalEventStore.createStream({ after: globalCursor }).tail(ctx);

                // tslint:disable-next-line:no-floating-promises
                (async () => {
                    for await (let item of userStream) {
                        lastUserCursor = item.cursor;
                        item.cursor = lastUserCursor + ':' + lastGlobalCursor;
                        iterator.push(item);
                        if (!working) {
                            return;
                        }
                    }
                })();
                // tslint:disable-next-line:no-floating-promises
                (async () => {
                    for await (let item of globalStream) {
                        lastGlobalCursor = item.cursor;
                        item.cursor = lastUserCursor + ':' + lastGlobalCursor;
                        iterator.push(item);
                        if (!working) {
                            return;
                        }
                    }
                })();

                return iterator;
            }
        }
    }
} as GQLResolver;