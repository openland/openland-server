import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { IDs } from '../openland-module-api/IDs';
import { Store } from 'openland-module-db/FDB';
import { withActivatedUser } from '../openland-module-api/Resolvers';
import { Modules } from '../openland-modules/Modules';
import { Context } from '@openland/context';
import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import RoomRoot = GQLRoots.RoomRoot;

const resolveRoomPowerups = async (root: RoomRoot, args: unknown, ctx: Context) => {
    let cid: number;
    if (typeof root === 'number') {
        cid = root;
    } else {
        cid = root.id;
    }
    let powerups = await Modules.Powerups.findPowerupsInChat(ctx, cid);
    return await Promise.all(powerups.map(a => Store.ChatPowerup.findById(ctx, a, cid)));
};

export default {
    PowerupPermission: {
      LOCATION: 'location'
    },
    Powerup: {
        id: root => IDs.Powerup.serialize(root.id),
        description: root => root.description,
        image: root => root.image,
        imageInfo: root => root.imageInfo,
        imagePreview: root => root.imagePreview,
        name: root => root.name,
        permissions: root => root.permissions,
    },
    PowerupUserSettings: {
        enabled: root => root.enabled,
    },
    RoomPowerup: {
        powerup: (root, args, ctx) => Store.Powerup.findById(ctx, root.pid),
        userSettings: withActivatedUser((ctx, args, uid, root) => {
            return Modules.Powerups.extractSettingsFromChatPowerup(root, uid);
        })
    },
    SharedRoom: {
        powerups: resolveRoomPowerups,
    },
    PrivateRoom: {
        powerups: resolveRoomPowerups,
    },
    Mutation: {
        createPowerup: withActivatedUser((ctx, args) => {
           return Modules.Powerups.createPowerup(ctx, {
               ...args.input,
               permissions: args.input.permissions as any
           });
        }),
        updatePowerup: withActivatedUser((ctx, args) => {
            let pid = IDs.Powerup.parse(args.id);
           return Modules.Powerups.editPowerup(ctx, pid, {
               ...args.input,
               permissions: args.input.permissions as any
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
        })
    }
} as GQLResolver;