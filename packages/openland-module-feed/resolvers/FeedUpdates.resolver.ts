import { GQL, GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import FeedUpdateRoot = GQLRoots.FeedUpdateRoot;
import { AppContext } from '../../openland-modules/AppContext';
import { Modules } from '../../openland-modules/Modules';
import { Store } from '../../openland-module-db/FDB';
import {
    FeedEvent,
    FeedItemDeletedEvent,
    FeedItemReceivedEvent,
    FeedItemUpdatedEvent,
    FeedRebuildEvent, FeedTopic
} from '../../openland-module-db/store';
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
            } else if (src instanceof FeedRebuildEvent) {
                return 'FeedRebuildNeeded';
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
    FeedRebuildNeeded: {
        homeFeed: async (src, args, ctx) => {
            let subscriptions = await Modules.Feed.findSubscriptions(ctx, 'user-' + ctx.auth.uid);
            let globalTopics = await Store.FeedTopic.global.findAll(ctx);
            let topics: FeedTopic[] = [...globalTopics, ...(await Promise.all(subscriptions.map(tid => Store.FeedTopic.findById(ctx, tid))))] as FeedTopic[];
            topics = topics.filter(t => t.key.startsWith('channel-'));

            let allEvents: FeedEvent[] = [];
            let topicPosts = await Promise.all(topics.map(t => Store.FeedEvent.fromTopic.query(ctx, t.id, {
                reverse: true,
                limit: 20
            })));
            for (let posts of topicPosts) {
                allEvents.push(...posts.items);
            }
            let items = allEvents.sort((a, b) => b.id - a.id).splice(0, 20);
            return {
                items,
                cursor: items.length > 0 ? IDs.HomeFeedCursor.serialize(items[items.length - 1].id) : undefined
            };
        }
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