import { GQLResolver, GQL } from '../openland-module-api/schema/SchemaSpec';
import { withActivatedUser } from '../openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { IDs } from '../openland-module-api/IDs';
import { combineAsyncIterators } from '../openland-utils/combineAsyncIterators';
import { AuthContext } from '../openland-module-auth/AuthContext';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { NotFoundError } from '../openland-errors/NotFoundError';

export default {
    UserLocation: {
        id: root => IDs.User.serialize(root.uid),
        user: root => root.uid,
        isSharing: root => !!root.isSharing,
        lastLocations: root => root.lastLocations.map(a => a.location)
    },
    Query: {
        myLocation: withActivatedUser((ctx, args, uid) => Modules.Geo.getUserGeo(ctx, uid)),
        chatLocations: withActivatedUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.id);
            let conv = Store.Conversation.findById(ctx, cid);
            if (!conv) {
                throw new NotFoundError();
            }
            let members: number[] = await Modules.Messaging.room.findConversationMembers(ctx, cid);
            if (!members.includes(uid)) {
                throw new AccessDeniedError();
            }

            return await Promise.all(members.map(a => Modules.Geo.getUserGeo(ctx, a)));
        })
    },
    Mutation: {
        shareLocation: withActivatedUser( async (ctx, args, uid) => {
            await Modules.Geo.reportGeo(ctx, uid, args.location);
            return true;
        }),
        stopSharingLocation: withActivatedUser(async (ctx, args, uid) => {
            await Modules.Geo.stopSharingGeo(ctx, uid);
            return true;
        })
    },
    Subscription: {
        chatLocationUpdates: {
            resolve: async (obj) => {
                return obj;
            },
            subscribe: async function* (r: any, args: GQL.SubscriptionChatLocationUpdatesArgs, ctx: Context) {
                let cid = IDs.Conversation.parse(args.id);
                let auth = AuthContext.get(ctx);
                let chatMembers = await Modules.Messaging.room.findConversationMembers(ctx, cid);
                if (!auth.uid || !chatMembers.includes(auth.uid!)) {
                    throw new AccessDeniedError();
                }

                let iterators = [];
                for (let member of chatMembers) {
                    iterators.push(Store.UserLocationEventStore.createLiveStream(ctx, member, { batchSize: 1 })[Symbol.asyncIterator]());
                }
                for await (let event of combineAsyncIterators(...iterators)) {
                    yield await Modules.Geo.getUserGeo(ctx, (event.items[0] as any).uid);
                }
            },
        },
    },
} as GQLResolver;