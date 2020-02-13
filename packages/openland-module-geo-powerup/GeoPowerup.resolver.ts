import { GQL, GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withActivatedUser } from '../openland-module-api/Resolvers';
import { IDs } from '../openland-module-api/IDs';
import { Store } from '../openland-module-db/FDB';
import { NotFoundError } from '../openland-errors/NotFoundError';
import { Modules } from '../openland-modules/Modules';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { Context } from '@openland/context';
import { PermissionRequestInfo, Permissions } from '../openland-module-permissions/PermissionsRepository';
import { AuthContext } from '../openland-module-auth/AuthContext';
import { EventBus } from '../openland-module-pubsub/EventBus';
import { PowerupChatUserSettings } from '../openland-module-powerups/PowerupsRepository';
import { combineAsyncIterators } from '../openland-utils/combineAsyncIterators';
import { isDefined } from '../openland-utils/misc';

const getGeoPowerupId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'geo-powerup-id');
const getPermissionRequestInfo = (ctx: Context, appId: number, cid: number, uid: number): PermissionRequestInfo => {
    return {
        appType: 'powerup',
        appId: appId,
        gid: Permissions.LOCATION,
        scopeType: 'chat',
        scopeId: cid,
        uid,
    };
};

export const Resolver: GQLResolver = {
    Query: {
        chatLocations: withActivatedUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.id);
            let conv = Store.Conversation.findById(ctx, cid);
            if (!conv) {
                throw new NotFoundError();
            }
            let pid = await getGeoPowerupId(ctx);
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
            let memberLocations = await Promise.all(members.map(a => Modules.Geo.getUserGeo(ctx, a, getPermissionRequestInfo(ctx, pid!, cid, a))));

            return memberLocations.filter(isDefined);
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
                let pid = await getGeoPowerupId(ctx);
                if (!auth.uid || !chatMembers.includes(auth.uid!) || !pid) {
                    throw new AccessDeniedError();
                }

                // TODO: don't query all members
                let iterators = [];
                for (let member of chatMembers) {
                    iterators.push(Store.UserLocationEventStore.createLiveStream(ctx, member, { batchSize: 1 }));
                }

                let chatPowerup = (await Store.ChatPowerup.findById(ctx, pid, cid))!;

                // let membersSettings = await Modules.Powerups.getPowerupUsersSettingsInChat(ctx, pid, cid);
                let subcription = EventBus.subscribe(`powerup_settings_change_${pid}_${cid}`, async (data: { uid: number, settings: PowerupChatUserSettings }) => {
                    // membersSettings[data.uid] = data.settings;
                    chatPowerup = (await Store.ChatPowerup.findById(ctx, pid!, cid))!;
                });
                for await (let event of combineAsyncIterators(iterators, () => subcription.cancel())) {
                    let uid = (event.items[0] as any).uid;

                    let settings = Modules.Powerups.extractSettingsFromChatPowerup(chatPowerup, uid);
                    if (settings.enabled) {
                        yield await Modules.Geo.getUserGeo(ctx, uid, getPermissionRequestInfo(ctx, pid!, cid, uid));
                    }
                }
            },
        },
    },
};
