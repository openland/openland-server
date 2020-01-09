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
import { EventBus } from '../openland-module-pubsub/EventBus';
import { PowerupChatUserSettings } from '../openland-module-powerups/PowerupsRepository';

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
            let pid = await Modules.Geo.getGeoPowerupId(ctx);
            if (!pid) {
                throw new AccessDeniedError();
            }

            if (!await Modules.Powerups.hasPowerup(ctx, cid, pid)) {
                throw new AccessDeniedError();
            }

            let membersSettings = await Modules.Powerups.getPowerupUsersSettingsInChat(ctx, pid, cid);
            let members: number[] = await Modules.Messaging.room.findConversationMembers(ctx, cid);
            if (!members.includes(uid)) {
                throw new AccessDeniedError();
            }
            members = members.filter(a => membersSettings[a].enabled);

            return await Promise.all(members.map(a => Modules.Geo.getUserGeo(ctx, a)));
        }),
        shouldShareLocation: withActivatedUser((ctx, args, uid) => Modules.Geo.shouldShareLocation(ctx, uid))
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
                let pid = await Modules.Geo.getGeoPowerupId(ctx);
                if (!auth.uid || !chatMembers.includes(auth.uid!) || !pid) {
                    throw new AccessDeniedError();
                }

                let iterators = [];
                for (let member of chatMembers) {
                    iterators.push(Store.UserLocationEventStore.createLiveStream(ctx, member, { batchSize: 1 })[Symbol.asyncIterator]());
                }

                let membersSettings = await Modules.Powerups.getPowerupUsersSettingsInChat(ctx, pid, cid);
                EventBus.subscribe(`powerup_settings_change_${pid}_${cid}`, (data: { uid: number, settings: PowerupChatUserSettings }) => {
                    membersSettings[data.uid] = data.settings;
                });
                for await (let event of combineAsyncIterators(...iterators)) {
                    let uid = (event.items[0] as any).uid;
                    if (membersSettings[uid].enabled) {
                        yield await Modules.Geo.getUserGeo(ctx, uid);
                    }
                }
            },
        },
    },
} as GQLResolver;