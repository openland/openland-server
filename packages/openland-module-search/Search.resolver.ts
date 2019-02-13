import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withAccount } from '../openland-module-api/Resolvers';
import { Modules } from '../openland-modules/Modules';
import { FDB } from '../openland-module-db/FDB';
import { Conversation, Organization, User } from '../openland-module-db/schema';

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
        }
    },
    Query: {
        alphaGlobalSearch: withAccount(async (ctx, args, uid, oid) => {
            let query = args.query.trim();

            //
            // Organizations
            //
            let userOrgs = await Modules.Orgs.findUserOrganizations(ctx, uid);
            let orgsHitsPromise = Modules.Search.elastic.client.search({
                index: 'organization',
                type: 'organization',
                size: 10,
                body: {
                    query: {
                        function_score: {
                            query: { bool: { must: [{ match_phrase_prefix: { name: query } }] } },
                            functions: userOrgs.map(_oid => ({
                                filter: { match: { _id: _oid } },
                                weight: 2
                            })),
                            boost_mode: 'multiply'
                        }
                    }
                }
            });

            //
            // Users
            //
            let usersHitsPromise = (await Modules.Users.searchForUsers(ctx, query, { limit: 10, uid })).hits;

            //
            // User dialog rooms
            //

            let localRoomsHitsPromise = await Modules.Search.elastic.client.search({
                index: 'dialog',
                type: 'dialog',
                size: 10,
                body: {
                    query: {
                        bool: {
                            must: [
                                { match_phrase_prefix: { title: query } },
                                { term: { uid: uid } },
                                { term: { visible: true } }
                            ]
                        }
                    }
                }
            });

            //
            // Global rooms
            //
            let globalRoomHitsPromise = await Modules.Search.elastic.client.search({
                index: 'room',
                type: 'room',
                size: 10,
                body: {
                    query: { bool: { must: [{ match_phrase_prefix: { title: args.query } }, { term: { listed: true} }] } }
                }
            });

            let allHits = (await Promise.all([orgsHitsPromise, usersHitsPromise, localRoomsHitsPromise, globalRoomHitsPromise]))
                .map(d => d.hits.hits)
                .reduce((a, v) => a.concat(v), []);

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
                if (item instanceof Conversation) {
                    return item.kind !== 'private';
                }
                return true;
            });

            return data;
        })
    }
} as GQLResolver;