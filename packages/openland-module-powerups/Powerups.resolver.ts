import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { IDs } from '../openland-module-api/IDs';
import { Store } from 'openland-module-db/FDB';
import { withActivatedUser } from '../openland-module-api/Resolvers';
import { Modules } from '../openland-modules/Modules';
import { isDefined } from '../openland-utils/misc';

export const Resolver: GQLResolver = {
    Powerup: {
        id: root => IDs.Powerup.serialize(root.id),
        description: root => root.description || '',
        image: root => root.image,
        name: root => root.name,
    },
    PowerupUserSettings: {
        enabled: root => root.enabled,
    },
    RoomPowerup: {
        id: (root) => IDs.ChatPowerup.serialize(`${root.pid}_${root.cid}`),
        powerup: async (root, args, ctx) => (await Store.Powerup.findById(ctx, root.pid))!,
        userSettings: withActivatedUser(async (ctx, args, uid, root) => {
            return Modules.Powerups.extractSettingsFromChatPowerup(root, uid);
        })
    },
    Mutation: {
        createPowerup: withActivatedUser((ctx, args) => {
           return Modules.Powerups.createPowerup(ctx, {
               ...args.input,
           });
        }),
        updatePowerup: withActivatedUser((ctx, args) => {
            let pid = IDs.Powerup.parse(args.id);
           return Modules.Powerups.editPowerup(ctx, pid, {
               ...args.input,
           });
        }),
        addPowerupToChat: withActivatedUser((ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.id);
            let pid = IDs.Powerup.parse(args.powerupId);
            return Modules.Powerups.addPowerupToChat(ctx, pid, cid, uid);
        }),
        removePowerupFromChat: withActivatedUser((ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.id);
            let pid = IDs.Powerup.parse(args.powerupId);
            return Modules.Powerups.removePowerupFromChat(ctx, pid, cid, uid);
        }),
        updatePowerupUserSettingsInChat: withActivatedUser((ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.id);
            let pid = IDs.Powerup.parse(args.powerupId);

            return Modules.Powerups.editPowerupUserSettingsInChat(ctx, pid, cid, uid, args.settings);
        })
    },
    Query: {
        powerups: withActivatedUser(  ctx => {
            return Modules.Powerups.findPowerups(ctx);
        }),
        chatsWithPowerup: withActivatedUser(async (ctx, args, uid) => {
            let pid = IDs.Powerup.parse(args.id);
            let chatPowerups = await Modules.Powerups.findChatsWithPowerup(ctx, uid, pid);
            return chatPowerups.map(a => a.cid);
        }),
        chatPowerups: withActivatedUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.id);
            let powerups = await Modules.Powerups.findPowerupsInChat(ctx, cid);
            return (await Promise.all(powerups.map(a => Store.ChatPowerup.findById(ctx, a, cid)))).filter(isDefined);
        })
    }
};
