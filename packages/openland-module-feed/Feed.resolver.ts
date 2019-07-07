import { FeedEvent } from './../openland-module-db/store';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';

export default {
    FeedItem: {
        id: (src) => IDs.FeedItem.serialize(src.id),
        text: (src) => src.content.text,
        date: (src) => src.metadata.createdAt,
        alphaBy: (src) => src.content.uid
    },
    Query: {
        alphaHomeFeed: withUser(async (ctx, args, uid) => {
            let allUids = Array.from(new Set(['user-' + uid, ...(await Store.UserEdge.forward.findAll(ctx, uid)).map((v) => 'user-' + v.uid2)]));

            let subscriptions = await Promise.all(allUids.map((v) => Modules.Feed.resolveTopic(ctx, v)));
            // let subscriptions = await Modules.Feed.findSubscriptions(ctx, 'user-' + uid);
            let allEvents: FeedEvent[] = [];
            for (let s of subscriptions) {
                for (let t of await Store.FeedEvent.topic.findAll(ctx, s.id)) {
                    allEvents.push(t);
                }
            }
            allEvents = allEvents.sort((a, b) => b.id - a.id);
            return allEvents;
        })
    },
    Mutation: {
        alphaCreateFeedPost: withUser(async (ctx, args, uid) => {
            return Modules.Feed.createEvent(ctx, 'user-' + uid, 'post', { text: args.message, uid });
        })
    }
} as GQLResolver;