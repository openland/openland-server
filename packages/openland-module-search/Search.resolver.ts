import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withAccount } from '../openland-module-api/Resolvers';
import { Modules } from '../openland-modules/Modules';
import { Store } from '../openland-module-db/FDB';
import { Message } from '../openland-module-db/store';
import { buildElasticQuery, QueryParser } from '../openland-utils/QueryParser';
import { inTx } from '@openland/foundationdb';
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { User, Organization, Conversation } from 'openland-module-db/store';
import { IDs } from '../openland-module-api/IDs';

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
    },
    MessageWithChat: {
        message: src => src.message, chat: src => src.chat,
    },
    Query: {
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
                            query: {bool: {must: [{match_phrase_prefix: {name: query}}]}},
                            functions: userOrgs.map(_oid => ({
                                filter: {match: {_id: _oid}}, weight: 2,
                            })),
                            boost_mode: 'multiply',
                        },
                    },
                },
            });

            //
            // Users
            //
            let usersHitsPromise = Modules.Users.searchForUsers(ctx, query, {byName: true, limit: 10, uid});

            //
            // User dialog rooms
            //

            let functions: any[] = [];
            let [topPrivateDialogs, topGroupDialogs] = await Promise.all([
                Store.UserEdge.forwardWeight.query(ctx, uid, {limit: 300, reverse: true}),
                Store.UserGroupEdge.user.query(ctx, uid, {limit: 300, reverse: true})
            ]);
            // Boost top dialogs
            topPrivateDialogs.items.forEach(dialog => functions.push({
                filter: {match: {uid2: dialog.uid2}},
                weight: dialog.weight || 1
            }));
            topGroupDialogs.items.forEach(dialog => functions.push({
                filter: {match: {cid: dialog.cid}},
                weight: dialog.weight || 1
            }));

            let localDialogsHitsPromise = Modules.Search.elastic.client.search({
                index: 'dialog', type: 'dialog', size: 10, body: {
                    query: {
                        function_score: {
                            query: {
                                bool: {
                                    must: [...(query.length ? [{match_phrase_prefix: {title: query}}] : []), ...[{term: {uid: uid}}, {term: {visible: true}}]],
                                },
                            },
                            functions: functions,
                            boost_mode: 'multiply'
                        }
                    }
                },
            });

            //
            // Global rooms
            //
            let globalRoomHitsPromise = Modules.Search.elastic.client.search({
                index: 'room', type: 'room', size: 10, body: {
                    sort: [{membersCount: {'order': 'desc'}}],
                    query: {
                        bool: {
                            must: [...(query.length ? [{match_phrase_prefix: {title: query}}] : []), {term: {listed: true}}]
                        }
                    },
                },
            });

            //
            // Organization rooms
            //
            let organizations = await Store.OrganizationMember.user.findAll(ctx, 'joined', uid);
            let orgChatFilters = organizations.map(e => ({term: {oid: e.oid}}));
            let orgRoomHitsPromise = Modules.Search.elastic.client.search({
                index: 'room', type: 'room', size: 10, body: {
                    query: {
                        bool: {
                            must: [
                                ...(query.length ? [{match_phrase_prefix: {title: query}}] : []),
                                {term: {listed: false}},
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
                localDialogsHits,
                globalRoomHits,
                orgRoomHits,
                orgsHits
            ] = await Promise.all([
                usersHitsPromise,
                localDialogsHitsPromise,
                globalRoomHitsPromise,
                orgRoomHitsPromise,
                orgsHitsPromise
            ]);

            let allHits = [...localDialogsHits.hits.hits, ...usersHits.hits.hits.hits, ...orgRoomHits.hits.hits, ...globalRoomHits.hits.hits, ...orgsHits.hits.hits];

            let dataPromises = allHits.map(hit => {
                if (hit._type === 'user_profile') {
                    return Store.User.findById(ctx, parseInt(hit._id, 10));
                } else if (hit._type === 'organization') {
                    return Store.Organization.findById(ctx, parseInt(hit._id, 10));
                } else if (hit._type === 'dialog') {
                    let val = (hit._source as any);
                    if (!val.cid) {
                        return null;
                    }
                    if (val.uid2) {
                        return Store.User.findById(ctx, val.uid2);
                    }
                    return Store.Conversation.findById(ctx, val.cid);
                } else if (hit._type === 'room') {
                    let cid = (hit._source as any).cid;
                    if (!cid) {
                        return null;
                    }
                    return Store.Conversation.findById(ctx, cid);
                } else {
                    return null;
                }
            });

            let data = await Promise.all(dataPromises as Promise<User | Organization | Conversation>[]);

            let rooms = new Set<number>();
            let users = new Set<number>();

            data = data.filter(value => {
                if (value instanceof User) {
                    if (!users.has(value.id)) {
                        users.add(value.id);
                        return true;
                    } else {
                        return false;
                    }
                }
                if (value instanceof Conversation) {
                    if (!rooms.has(value.id)) {
                        rooms.add(value.id);
                        return true;
                    } else {
                        return false;
                    }
                }
                return true;
            });

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
                } else {
                    if (item instanceof Conversation) {
                        return item.kind !== 'private';
                    }
                }
                return true;
            });

            return data;
        }),
        featuredGroups: withAccount(async (ctx, args, uid, oid) => {
            let globalRoomHits = await Modules.Search.elastic.client.search({
                index: 'room', type: 'room', body: {
                    query: {bool: {must: [{term: {featured: true}}]}},
                },
            });
            return globalRoomHits.hits.hits.map(hit => parseInt(hit._id, 10));
        }),
        featuredCommunities: withAccount(async (ctx, args, uid, oid) => {
            let hits = await Modules.Search.elastic.client.search({
                index: 'organization',
                type: 'organization',
                body: {query: {bool: {must: [{term: {kind: 'community'}}, {term: {featured: true}}]}}},
            });
            let oids = hits.hits.hits.map(hit => parseInt(hit._id, 10));
            let orgs = oids.map(o => Store.Organization.findById(ctx, o)!);
            return await Promise.all(orgs);
        }),

        messagesSearch: withAccount(async (ctx, args, uid, oid) => {
            try {
                let userDialogs = await inTx(createNamedContext('messagesSearch'), async ctx2 => await Modules.Messaging.findUserDialogs(ctx2, uid));

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

                clauses.push({terms: {cid: userDialogs.map(d => d.cid)}});

                let hits = await Modules.Search.elastic.client.search({
                    index: 'message',
                    type: 'message',
                    size: args.first,
                    from: args.after ? parseInt(args.after, 10) : 0,
                    body: {
                        sort: sort || [{createdAt: 'desc'}], query: {bool: {must: clauses}},
                    },
                });

                let messages: (Message | null)[] = await Promise.all(hits.hits.hits.map((v) => Store.Message.findById(ctx, parseInt(v._id, 10))));
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
        chatMembersSearch: withAccount(async (ctx, args, uid, oid) => {
            let cid = IDs.Conversation.parse(args.cid);
            await Modules.Messaging.room.checkCanUserSeeChat(ctx, uid, cid);
            let members = (await Store.RoomParticipant.active.findAll(ctx, cid)).map(m => m.uid);

            let query = args.query || '';
            let clauses: any[] = [];
            clauses.push({terms: {userId: members}});
            clauses.push({
                bool: {
                    should: query.trim().length > 0 ? [
                        {match_phrase_prefix: {name: query}},
                        {match_phrase_prefix: {shortName: query}}
                    ] : []
                }
            });

            let hits = await Modules.Search.elastic.client.search({
                index: 'user_profile',
                type: 'user_profile',
                size: args.first || 20,
                body: {
                    query: {bool: {must: clauses}},
                },
                from: args && args.after ? parseInt(args.after, 10) : (args && args.page ? ((args.page - 1) * (args && args.first ? args.first : 20)) : 0),
            });

            let offset = 0;
            if (args.after) {
                offset = parseInt(args.after, 10);
            } else if (args.page) {
                offset = (args.page - 1) * args.first;
            }

            let uids = hits.hits.hits.map((v) => parseInt(v._id, 10));
            let total = hits.hits.total;

            // Fetch profiles
            let users = (await Promise.all(uids.map((v) => Store.User.findById(ctx, v)))).filter(u => u);

            return {
                edges: users.map((p, i) => {
                    return {
                        node: p,
                        cursor: (i + 1 + offset).toString()
                    };
                }),
                pageInfo: {
                    hasNextPage: (total - (offset + 1)) >= args.first, // ids.length === this.limitValue,
                    hasPreviousPage: false,

                    itemsCount: total,
                    pagesCount: Math.min(Math.floor(8000 / args.first), Math.ceil(total / args.first)),
                    currentPage: Math.floor(offset / args.first) + 1,
                    openEnded: true
                },
            };
        }),
        chatMentionSearch: withAccount(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.cid);
            let thisConvOrg = await Store.ConversationRoom.findById(ctx, cid);
            let chatOid = thisConvOrg ? thisConvOrg.oid : null;

            await Modules.Messaging.room.checkCanUserSeeChat(ctx, uid, cid);
            let members = (await Store.RoomParticipant.active.findAll(ctx, cid)).map(m => m.uid);

            let query = args.query || '';
            query = query.trim();

            let clauses: any[] = [];
            clauses.push({terms: {userId: members}});
            clauses.push({
                bool: {
                    should: query.trim().length > 0 ? [
                        {match_phrase_prefix: {name: query}},
                        {match_phrase_prefix: {shortName: query}}
                    ] : []
                }
            });

            let hits = await Modules.Search.elastic.client.search({
                index: 'user_profile',
                type: 'user_profile',
                size: 20,
                body: {
                    query: {bool: {must: clauses}},
                },
            });

            let uids = hits.hits.hits.map((v) => parseInt(v._id, 10));
            if (!query) {
                return (await Promise.all(uids.map((v) => Store.User.findById(ctx, v)))).filter(u => u);
            }

            //
            // Organizations
            //
            let userOrgs = await Modules.Orgs.findUserOrganizations(ctx, uid);
            let orgsHitsPromise = Modules.Search.elastic.client.search({
                index: 'organization', type: 'organization', size: 10, body: {
                    query: {
                        function_score: {
                            query: {bool: {must: [{match_phrase_prefix: {name: query}}]}},
                            functions: userOrgs.map(_oid => ({
                                filter: {match: {_id: _oid}}, weight: 2,
                            })),
                            boost_mode: 'multiply',
                        },
                    },
                },
            });

            //
            // Users
            //
            let usersHitsPromise = Modules.Users.searchForUsers(ctx, query, {byName: true, limit: 10, uid});

            //
            // Global rooms
            //
            let globalRoomHitsPromise = Modules.Search.elastic.client.search({
                index: 'room', type: 'room', size: 10, body: {
                    sort: [{membersCount: {'order': 'desc'}}],
                    query: {
                        bool: {
                            must: [...(query.length ? [{match_phrase_prefix: {title: query}}] : []), {term: {listed: true}}]
                        }
                    },
                },
            });

            //
            // Organization rooms
            //
            let organizations = await Store.OrganizationMember.user.findAll(ctx, 'joined', uid);
            let orgChatFilters = organizations.map(e => ({term: {oid: e.oid}}));
            let orgRoomHitsPromise = Modules.Search.elastic.client.search({
                index: 'room', type: 'room', size: 10, body: {
                    query: {
                        bool: {
                            must: [
                                ...(query.length ? [{match_phrase_prefix: {title: query}}] : []),
                                {term: {listed: false}},
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
                globalRoomHits,
                orgRoomHits,
                orgsHits
            ] = await Promise.all([
                usersHitsPromise,
                globalRoomHitsPromise,
                orgRoomHitsPromise,
                orgsHitsPromise
            ]);

            let allHits = [...usersHits.hits.hits.hits, ...orgRoomHits.hits.hits, ...globalRoomHits.hits.hits, ...orgsHits.hits.hits];

            let dataPromises = [
                    ...uids.map((v) => Store.User.findById(ctx, v)),
                ...allHits.map(async hit => {
                if (hit._type === 'user_profile') {
                    return await Store.User.findById(ctx, parseInt(hit._id, 10));
                } else if (hit._type === 'organization') {
                    return await Store.Organization.findById(ctx, parseInt(hit._id, 10));
                } else if (hit._type === 'room') {
                    let roomCid = (hit._source as any).cid;
                    if (!roomCid) {
                        return null;
                    }

                    let conv = await Store.Conversation.findById(ctx, roomCid);
                    let convRoom = await Store.ConversationRoom.findById(ctx, roomCid);

                    if (convRoom && convRoom.kind !== 'public') {
                        return null;
                    }

                    if (convRoom && convRoom.oid) {
                        let o = await Store.Organization.findById(ctx, convRoom.oid);
                        if (o && (o.kind === 'organization' || o.private) && chatOid !== convRoom.oid) {
                            return null;
                        }
                    }

                    return conv;
                } else {
                    return null;
                }
            })];

            let data = await Promise.all(dataPromises as Promise<User | Organization | Conversation>[]);

            let rooms = new Set<number>();
            let users = new Set<number>();

            data = data.filter(value => {
                if (value instanceof User) {
                    if (!users.has(value.id)) {
                        users.add(value.id);
                        return true;
                    } else {
                        return false;
                    }
                }
                if (value instanceof Conversation) {
                    if (!rooms.has(value.id)) {
                        rooms.add(value.id);
                        return true;
                    } else {
                        return false;
                    }
                }
                return true;
            });

            return data.filter(item => {
                if (!item) {
                    return false;
                }

                if (item instanceof Conversation) {
                    return item.kind !== 'private';
                }
                return false;
            });
        })
    },
} as GQLResolver;