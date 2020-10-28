import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withAny } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';
import { IDs } from '../../openland-module-api/IDs';
import { Store } from '../../openland-module-db/FDB';

export const Resolver: GQLResolver = {
    PopularNowRoom: {
        room: root => root.room.id,
        newMessages: root => root.messagesDelta,
    },
    PopularNowOrganization: {
        organization: root => root.organization,
        newMessages: root => root.messagesDelta,
    },
    Query: {
        discoverPopularNow: withAny(async (ctx, args) => {
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
                items: popular,
                cursor: popular.length === args.first ? IDs.DiscoverPopularNowCursor.serialize(popular[popular.length - 1].cursor) : null
            };
        }),
        discoverTopPremium: withAny(async (ctx, args) => {
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
                                    must: [{term: {listed: true}}, {term: {isPremium: true}}]
                                }
                            },
                            boost_mode: 'multiply'
                        }
                    },
                },
            });

            return {
                items: roomHits.hits.hits.map(a => parseInt(a._id, 10)),
                cursor: (roomHits.hits.total as any).value <= (from + args.first) ? null : IDs.DiscoverTopPremiumCursor.serialize(from + args.first),
            };
        }),
        discoverTopFree: withAny(async (ctx, args) => {
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
                                    must: [{term: {listed: true}}, {term: {isPremium: false}}]
                                }
                            },
                            boost_mode: 'multiply'
                        }
                    },
                },
            });

            return {
                items: roomHits.hits.hits.map(a => parseInt(a._id, 10)),
                cursor: (roomHits.hits.total as any).value <= (from + args.first) ? null : IDs.DiscoverTopFreeCursor.serialize(from + args.first),
            };
        }),
        discoverNewAndGrowing: withAny(async (ctx, args) => {
            let clauses: any[] = [];

            // chats with members count > 10
            clauses.push({range: {membersCount: {gte: 10}}});
            // chats with messages count > 10
            clauses.push({range: {messagesCount: {gte: 10}}});
            // chats 90- days old
            clauses.push({range: {createdAt: {gte: 'now-90d/d'}}});
            // only public chats
            clauses.push({ term: { listed: true } });

            let query: any = {bool: {must: clauses}};
            query = {
                function_score: {
                    query,
                    random_score: {
                        seed: args.seed,
                        field: '_id'
                    }
                }
            };

            let from = args.after ? parseInt(args.after, 10) : 0;
            let hits = await Modules.Search.elastic.client.search({
                index: 'room',
                type: 'room',
                size: args.first,
                from,
                body: {
                    query,
                },
            });

            return {
                items: hits.hits.hits.map(a => parseInt(a._id, 10)),
                cursor: (hits.hits.total as any).value > (from + args.first) ? (from + args.first).toString() : null,
            };
        }),
        discoverNewAndGrowingOrganizations: withAny(async (ctx, args) => {
            let clauses: any[] = [];

            // orgs with members count > 10
            clauses.push({range: {membersCount: {gte: 10}}});
            // orgs 60- days old
            clauses.push({range: {createdAt: {gte: 'now-60d/d'}}});
            // only public orgs
            clauses.push({ term: { listed: true } });

            let from = args.after ? parseInt(args.after, 10) : 0;
            let hits = await Modules.Search.elastic.client.search({
                index: 'organization',
                type: 'organization',
                size: args.first,
                from,
                body: {
                    query: {bool: {must: clauses}},
                    sort: [{membersCount: {'order': 'desc'}}]
                },
            });

            let orgs = await Promise.all(hits.hits.hits.map(a => parseInt(a._id, 10)).map(async a => (await Store.Organization.findById(ctx, a))!));

            return {
                items: orgs,
                cursor: (hits.hits.total as any).value > (from + args.first) ? (from + args.first).toString() : null,
            };
        }),
        discoverPopularNowOrganizations: withAny(async (ctx, args) => {
            let after = 0;
            if (args.after) {
                after = IDs.DiscoverPopularNowOrganizationCursor.parse(args.after);
            }
            let popular = await Modules.Stats.getTrendingOrgsByMessages(
                ctx,
                Date.now() - 7 * 24 * 60 * 60 * 1000,
                Date.now(),
                args.first,
                after
            );

            return {
                items: popular,
                cursor: popular.length === args.first ? IDs.DiscoverPopularNowOrganizationCursor.serialize(popular[popular.length - 1].cursor) : null
            };
        }),
    }
};
