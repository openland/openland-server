import { GQLResolver, GQL } from '../openland-module-api/schema/SchemaSpec';
import { withActivatedUser } from '../openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { IDs } from '../openland-module-api/IDs';
import { combineAsyncIterators } from '../openland-utils/combineAsyncIterators';
import { AuthContext } from '../openland-module-auth/AuthContext';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';

export default {
    UserLocation: {
        user: uid => uid,
        lastLocations:  async (uid, args, ctx) => {
            let geo = await Modules.Geo.getUserGeo(ctx, uid);
            return geo.lastLocations.map(a => a.location);
        },
    },
    Query: {
        myLocation: withActivatedUser((ctx, args, uid) => uid),
    },
    SharedRoom: {
       memberLocations: withActivatedUser(async (ctx, args, uid, root) => {
           let members: number[] = [];
           if (typeof root === 'number') {
               members = await Modules.Messaging.room.findConversationMembers(ctx, root);
           } else {
               members = await Modules.Messaging.room.findConversationMembers(ctx, root.id);
           }
           if (!members.includes(uid)) {
               return [];
           }
           return members.filter(a => a !== uid);
       })
       }
    ,
    Mutation: {
        reportLocation: withActivatedUser( async (ctx, args, uid) => {
            await Modules.Geo.reportGeo(ctx, uid, args.location);
            return true;
        }),
    },
    Subscription: {
        chatLocationUpdates: {
            resolve: async (obj) => {
                return obj.uid;
            },
            subscribe: async function* (r: any, args: GQL.SubscriptionChatLocationUpdatesArgs, ctx: Context) {
                let cid = IDs.Conversation.parse(args.chatId);
                let auth = AuthContext.get(ctx);
                let chatMembers = await Modules.Messaging.room.findConversationMembers(ctx, cid);
                if (!auth.uid || !chatMembers.includes(auth.uid!)) {
                    throw new AccessDeniedError();
                }

                let iterators = [];
                for (let member of chatMembers) {
                    if (member === auth.uid) {
                        continue;
                    }

                    iterators.push(Store.UserLocationEventStore.createLiveStream(ctx, member, { batchSize: 1 })[Symbol.asyncIterator]());
                }
                for await (let event of combineAsyncIterators(...iterators)) {
                    yield event.items[0];
                }
            },
        },
    },
} as GQLResolver;