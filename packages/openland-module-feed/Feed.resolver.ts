import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';
import { FeedEvent } from 'openland-module-db/schema';
import { IDs } from 'openland-module-api/IDs';

export default {
    FeedItem: {
        id: (src) => IDs.FeedItem.serialize(src.id),
        text: (src) => src.content.text,
        date: (src) => src.createdAt,
        alphaBy: (src) => src.content.uid
    },
    Query: {
        alphaHomeFeed: withUser(async (ctx, args, uid) => {
            let subscriptions = await Modules.Feed.findSubscriptions(ctx, 'user-' + uid);
            let allEvents: FeedEvent[] = [];
            for (let s of subscriptions) {
                for (let t of await FDB.FeedEvent.allFromTopic(ctx, s)) {
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