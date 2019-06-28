import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withAccount } from '../openland-module-api/Resolvers';
import { Modules } from '../openland-modules/Modules';
import { FDB } from '../openland-module-db/FDB';
import { Conversation, Message, Organization, User } from '../openland-module-db/schema';
import { buildElasticQuery, QueryParser } from '../openland-utils/QueryParser';
import { inTx } from '@openland/foundationdb';
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';

const log = createLogger('search-resolver');

export default {
    GlobalSearchEntry: {
        __resolveType(obj: any) {
            if (obj instanceof Organization) {
                return 'Organization';
            } else if (obj instanceof User) {
                return 'User';
            } else if (obj instanceof Conversation) {
                if (obj.kind === 'private') {
                    return 'PrivateRoom';
                } else {
                    return 'SharedRoom';
                }
            }

            throw new Error('Unknown search entry' + obj);
        },
    }, MessageWithChat: {
        message: src => src.message, chat: src => src.chat,
    }, Query: {
        alphaGlobalSearch: withAccount(async (ctx, args, uid, oid) => {
            let query = args.query.trim();

            //
            // Organizations
            //
            let userOrgs = await Modules.Orgs.findUserOrganizations(ctx, uid);
            let orgsHitsPromise = Modules.Search.elastic.client.search({
                index: 'organization', type: 'organization', size: 10, body: {
                    query: {
                        function_score: {
                            query: { bool: { must: [{ match_phrase_prefix: { name: query } }] } },
                            functions: userOrgs.map(_oid => ({
                                filter: { match: { _id: _oid } }, weight: 2,
                            })),
                            boost_mode: 'multiply',
                        },
                    },
                },
            });

            //
            // Users
            //
            let usersHitsPromise = Modules.Users.searchForUsers(ctx, query, { byName: true, limit: 10, uid });

            //
            // User dialog rooms
            //

            let localRoomsHitsPromise = Modules.Search.elastic.client.search({
                index: 'dialog', type: 'dialog', size: 10, body: {
                    query: {
                        bool: {
                            must: [{ match_phrase_prefix: { title: query } }, { term: { uid: uid } }, { term: { visible: true } }],
                        },
                    },
                },
            });

            //
            // Global rooms
            //
            let globalRoomHitsPromise = Modules.Search.elastic.client.search({
                index: 'room', type: 'room', size: 10, body: {
                    query: { bool: { must: [{ match_phrase_prefix: { title: args.query } }, { term: { listed: true } }] } },
                },
            });

            //
            // Organization rooms
            //
            let organizations = await FDB.OrganizationMember.allFromUser(ctx, 'joined', uid);
            let orgChatFilters = organizations.map(e => ({ term: { oid: e.oid } }));
            let orgRoomHitsPromise = Modules.Search.elastic.client.search({
                index: 'room', type: 'room', size: 10, body: {
                    query: {
                        bool: {
                            must: [
                                { match_phrase_prefix: { title: args.query } }, { term: { orgKind: 'organization' } },
                                {
                                    bool: {
                                        should: orgChatFilters
                                    }
                                }
                            ],
                        },
                    },
                },
            });

            let [
                usersHits,
                localRoomsHits,
                globalRoomHits,
                orgRoomHits,
                orgsHits
            ] = await Promise.all([
                usersHitsPromise,
                localRoomsHitsPromise,
                globalRoomHitsPromise,
                orgRoomHitsPromise,
                orgsHitsPromise
            ]);

            let allHits = [...usersHits.hits.hits.hits, ...localRoomsHits.hits.hits, ...globalRoomHits.hits.hits, ...orgRoomHits.hits.hits, ...orgsHits.hits.hits];

            let rooms = new Set<number>();
            let users = new Set<number>();

            allHits = allHits.filter(hit => {
                if (hit._type === 'dialog' || hit._type === 'room') {
                    let cid = (hit._source as any).cid;
                    if (!rooms.has(cid)) {
                        rooms.add(cid);
                        return true;
                    } else {
                        return false;
                    }
                }

                if (hit._type === 'user_profile') {
                    let userId = parseInt(hit._id, 10);
                    users.add(userId);
                }
                return true;
            });

            let dataPromises = allHits.map(hit => {
                if (hit._type === 'user_profile') {
                    return FDB.User.findById(ctx, parseInt(hit._id, 10));
                } else if (hit._type === 'organization') {
                    return FDB.Organization.findById(ctx, parseInt(hit._id, 10));
                } else if (hit._type === 'dialog' || hit._type === 'room') {
                    let cid = (hit._source as any).cid;
                    if (!cid) {
                        return null;
                    }
                    return FDB.Conversation.findById(ctx, cid);
                } else {
                    return null;
                }
            });

            let data = await Promise.all(dataPromises as Promise<User | Organization | Conversation>[]);

            data = data.filter(item => {
                if (!item) {
                    return false;
                }
                if (args.kinds && args.kinds.length > 0) {
                    if ((item instanceof Organization) && args.kinds.indexOf('ORGANIZATION') >= 0) {
                        return true;
                    } else if ((item instanceof User) && args.kinds.indexOf('USER') >= 0) {
                        return true;
                    } else if ((item instanceof Conversation) && args.kinds.indexOf('SHAREDROOM') >= 0) {
                        return item.kind !== 'private';
                    }

                    return false;
                }
                if (item instanceof Conversation) {
                    return item.kind !== 'private';
                }
                return true;
            });

            return data;
        }), featuredGroups: withAccount(async (ctx, args, uid, oid) => {
            let globalRoomHits = await Modules.Search.elastic.client.search({
                index: 'room', type: 'room', body: {
                    query: { bool: { must: [{ term: { featured: true } }] } },
                },
            });
            return globalRoomHits.hits.hits.map(hit => parseInt(hit._id, 10));
        }), featuredCommunities: withAccount(async (ctx, args, uid, oid) => {
            let hits = await Modules.Search.elastic.client.search({
                index: 'organization',
                type: 'organization',
                body: { query: { bool: { must: [{ term: { kind: 'community' } }, { term: { featured: true } }] } } },
            });
            let oids = hits.hits.hits.map(hit => parseInt(hit._id, 10));
            let orgs = oids.map(o => FDB.Organization.findById(ctx, o)!);
            return await Promise.all(orgs);
        }),

        messagesSearch: withAccount(async (ctx, args, uid, oid) => {
            try {
                let userDialogs = await inTx(createNamedContext('messagesSearch'), async ctx2 => await FDB.UserDialog.allFromUser(ctx2, uid));

                let clauses: any[] = [];
                let sort: any[] | undefined = undefined;

                let parser = new QueryParser();
                parser.registerText('text', 'text');
                parser.registerBoolean('isService', 'isService');
                parser.registerText('createdAt', 'createdAt');
                parser.registerText('updatedAt', 'updatedAt');

                let parsed = parser.parseQuery(args.query);
                let elasticQuery = buildElasticQuery(parsed);
                clauses.push(elasticQuery);

                if (args.sort) {
                    sort = parser.parseSort(args.sort);
                }

                clauses.push({ terms: { cid: userDialogs.map(d => d.cid) }});

                let hits = await Modules.Search.elastic.client.search({
                    index: 'message',
                    type: 'message',
                    size: args.first,
                    from: args.after ? parseInt(args.after, 10) : 0,
                    body: {
                        sort: sort || [{ createdAt: 'desc' }], query: { bool: { must: clauses } },
                    },
                });

                let messages: (Message | null)[] = await Promise.all(hits.hits.hits.map((v) => FDB.Message.findById(ctx, parseInt(v._id, 10))));
                let offset = 0;
                if (args.after) {
                    offset = parseInt(args.after, 10);
                }
                let total = hits.hits.total;

                return {
                    edges: messages.filter(m => !!m).map((p, i) => {
                        return {
                            node: {
                                message: p, chat: p!.cid,
                            }, cursor: (i + 1 + offset).toString(),
                        };
                    }), pageInfo: {
                        hasNextPage: (total - (offset + 1)) >= args.first, // ids.length === this.limitValue,
                        hasPreviousPage: false,

                        itemsCount: total,
                        pagesCount: Math.min(Math.floor(8000 / args.first), Math.ceil(total / args.first)),
                        currentPage: Math.floor(offset / args.first) + 1,
                        openEnded: true,
                    },
                };
            } catch (e) {
                log.error(ctx, e);
                return {
                    edges: [],
                    pageInfo: {
                        hasNextPage: false,
                        hasPreviousPage: false,

                        itemsCount: 0,
                        pagesCount: 0,
                        currentPage: 0,
                        openEnded: true,
                    },
                };
            }
        }),
    },
} as GQLResolver;