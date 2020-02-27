import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withActivatedUser } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';
import { IDs } from '../../openland-module-api/IDs';

export const Resolver: GQLResolver = {
    Query: {
        discoverPopularNow: withActivatedUser(async (ctx, args) => {
            let after = 0;
            if (args.after) {
                after = IDs.DiscoverPopularNowCursor.parse(args.after);
            }
            let popular = await Modules.Stats.getTrendingRoomsByMessages(
                ctx,
                Date.now() - 7 * 24 * 60 * 60 * 1000,
                Date.now(),
                args.first,
                after
            );

            return {
                items: popular.map(a => a.room.id),
                cursor: popular.length === args.first ? IDs.DiscoverPopularNowCursor.serialize(popular[popular.length - 1].cursor) : null
            };
        }),
        discoverTopPremium: withActivatedUser(async (ctx, args) => {
            let from = 0;
            if (args.after) {
                from = IDs.DiscoverTopPremiumCursor.parse(args.after);
            }
            let roomHits = await Modules.Search.elastic.client.search({
                index: 'room', type: 'room',
                size: args.first,
                from: from,
                body: {
                    sort: [{membersCount: {'order': 'desc'}}],
                    query: {
                        function_score: {
                            query: {
                                bool: {
                                    must: [{term: {listed: true}}, { term: { isPremium: true } }]
                                }
                            },
                            boost_mode: 'multiply'
                        }
                    },
                },
            });

            return {
                items: roomHits.hits.hits.map(a => parseInt(a._id, 10)),
                cursor: roomHits.hits.total <= (from + args.first) ? null : IDs.DiscoverTopPremiumCursor.serialize(from + args.first),
            };
        }),
        discoverTopFree: withActivatedUser(async (ctx, args) => {
            let from = 0;
            if (args.after) {
                from = IDs.DiscoverTopFreeCursor.parse(args.after);
            }
            let roomHits = await Modules.Search.elastic.client.search({
                index: 'room', type: 'room',
                size: args.first,
                from: from,
                body: {
                    sort: [{membersCount: {'order': 'desc'}}],
                    query: {
                        function_score: {
                            query: {
                                bool: {
                                    must: [{term: {listed: true}}, { term: { isPremium: false } }]
                                }
                            },
                            boost_mode: 'multiply'
                        }
                    },
                },
            });

            return {
                items: roomHits.hits.hits.map(a => parseInt(a._id, 10)),
                cursor: roomHits.hits.total <= (from + args.first) ? null : IDs.DiscoverTopFreeCursor.serialize(from + args.first),
            };
        })
    }
};
