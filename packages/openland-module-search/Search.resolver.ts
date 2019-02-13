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
            //
            // Organizations
            //
            let hits = await Modules.Search.elastic.client.search({
                index: 'organization',
                type: 'organization',
                size: 10,
                body: {
                    query: { bool: { must: [{ match_phrase_prefix: { name: args.query } }] } }
                }
            });
            let orgs = hits.hits.hits.map((v) => FDB.Organization.findById(ctx, parseInt(v._id, 10)));

            //
            // Users
            //
            let uids = await Modules.Users.searchForUsers(ctx, args.query, { limit: 10, uid });
            let users = uids.uids.map(id => FDB.User.findById(ctx, id));

            let roomIds = new Set<number>();
            //
            // User dialog rooms
            //
            let localRoomIds = await Modules.Messaging.search.searchForRooms(ctx, args.query, { uid, limit: 10 });
            localRoomIds.forEach(id => roomIds.add(id));

            //
            // Global rooms
            //
            let globalRoomHits = await Modules.Search.elastic.client.search({
                index: 'room',
                type: 'room',
                size: 10,
                body: {
                    query: { bool: { must: [{ match_phrase_prefix: { title: args.query } }, { term: { listed: true} }] } }
                }
            });
            globalRoomHits.hits.hits.forEach(v => roomIds.add(parseInt(v._id, 10)));

            let rooms = await Promise.all([...roomIds].map(id => FDB.Conversation.findById(ctx, id)));
            rooms = rooms.filter(r => r && r!.kind !== 'private');

            return [...orgs, ...users, ...rooms];
        })
    }
} as GQLResolver;