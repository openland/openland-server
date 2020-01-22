import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';
import { fetchNextDBSeq } from '../openland-utils/dbSeq';
import { ImageRef } from '../openland-module-media/ImageRef';
import { UserError } from 'openland-errors/UserError';
import { NotFoundError } from '../openland-errors/NotFoundError';
import { Sanitizer } from '../openland-utils/Sanitizer';
import { Modules } from '../openland-modules/Modules';
import { EventBus } from '../openland-module-pubsub/EventBus';
import { ChatPowerup } from '../openland-module-db/store';

export enum PowerupPermission {
    LOCATION = 'location'
}

export interface PowerupInput {
    name?: string | null;
    description?: string | null;
    image?: ImageRef | null;
    permissions?: PowerupPermission[] | null;
}

export interface PowerupChatUserSettings {
    enabled: boolean;
}

@injectable()
export class PowerupsRepository {
    createPowerup = (parent: Context, input: PowerupInput) => {
        return inTx(parent, async ctx => {
            if (!input.name || input.name.trim().length === 0) {
                throw new UserError('Name cannot be empty');
            }
            if (!input.permissions) {
                input.permissions = [];
            }

            input.image = Sanitizer.sanitizeImageRef(input.image);
            if (input.image) {
                await Modules.Media.saveFile(ctx, input.image.uuid);
            }

           return await Store.Powerup.create(ctx, await fetchNextDBSeq(ctx, 'powerup-id'), {
               name: input.name,
               permissions: input.permissions,
               description: input.description,
               image: input.image,
               deleted: false,
           });
        });
    }

    editPowerup = (parent: Context, id: number, input: PowerupInput) => {
        return inTx(parent, async ctx => {
            let powerup = await Store.Powerup.findById(ctx, id);
            if (!powerup) {
                throw new NotFoundError();
            }
            if (input.name && input.name.trim().length !== 0) {
                powerup.name = input.name;
            }
            if (input.permissions) {
                powerup.permissions = input.permissions;
            }
            input.image = Sanitizer.sanitizeImageRef(input.image);
            if (input.image) {
                powerup.image = input.image;
            }
            if (input.description) {
                powerup.description = input.description;
            }

            await powerup.flush(ctx);
            return powerup;
        });
    }

    getPowerup = async (parent: Context, id: number) => {
        return await Store.Powerup.findById(parent, id);
    }

    findPowerups = async (parent: Context) => {
        return await Store.Powerup.findAll(parent);
    }

    findChatsWithPowerup = async (ctx: Context, uid: number, pid: number) => {
        let myChats = await Modules.Messaging.findUserDialogs(ctx, uid);
        let chatsWithPowerup = await Store.ChatPowerup.byPid.findAll(ctx, pid);
        return chatsWithPowerup.filter(a => a.enabled && myChats.find(b => b.cid === a.cid));
    }

    findPowerupsInChat = async (ctx: Context, cid: number) => {
        let chatsWithPowerup = await Store.ChatPowerup.byCid.findAll(ctx, cid);
        return chatsWithPowerup.filter(a => a.enabled).map(a => a.pid);
    }

    hasPowerup = async (ctx: Context, cid: number, pid: number) => {
        let powerups = await this.findPowerupsInChat(ctx, cid);
        if (powerups.includes(pid)) {
            return true;
        }
        return false;
    }

    addPowerupToChat = (parent: Context, pid: number, cid: number, uid: number) => {
        return inTx(parent, async ctx => {
            let chatPowerup = await Store.ChatPowerup.findById(ctx, pid, cid);
            if (!chatPowerup) {
                await Store.ChatPowerup.create(ctx, pid, cid, {
                    enabled: true,
                    userSettings: {}
                });
                return true;
            }
            if (chatPowerup.enabled) {
                return false;
            }
            chatPowerup.enabled = true;
            await chatPowerup.flush(ctx);

            await Modules.Messaging.room.markConversationAsUpdated(ctx, cid, uid);
            return true;
        });
    }

    removePowerupFromChat = (parent: Context, pid: number, cid: number, uid: number) => {
        return inTx(parent, async ctx => {
            let chatPowerup = await Store.ChatPowerup.findById(ctx, pid, cid);
            if (!chatPowerup || !chatPowerup.enabled) {
                return false;
            }
            chatPowerup.enabled = false;
            await chatPowerup.flush(ctx);

            await Modules.Messaging.room.markConversationAsUpdated(ctx, cid, uid);
            return true;
        });
    }

    getChatPowerup = async (parent: Context, cid: number, pid: number) => {
        return await Store.ChatPowerup.findById(parent, pid, cid);
    }

    getPowerupUsersSettingsInChat = async (parent: Context, pid: number, cid: number) => {
        let chatPowerup = await Store.ChatPowerup.findById(parent, pid, cid);
        if (!chatPowerup) {
            throw new NotFoundError();
        }
        let chatMembers = await Modules.Messaging.room.findConversationMembers(parent, cid);

        let allSettings: { [key: number]: PowerupChatUserSettings } = {};
        for (let member of chatMembers) {
            allSettings[member] = this.extractSettingsFromChatPowerup(chatPowerup, member);
        }
        return allSettings;
    }

    getPowerupUserSettingsInChat = async (parent: Context, pid: number, cid: number, uid: number) => {
        let chatPowerup = await Store.ChatPowerup.findById(parent, pid, cid);
        if (!chatPowerup) {
            throw new NotFoundError();
        }
        return this.extractSettingsFromChatPowerup(chatPowerup, uid);
    }

    extractSettingsFromChatPowerup = (chatPowerup: ChatPowerup, uid: number): PowerupChatUserSettings => {
        return chatPowerup.userSettings[uid] || this._getPowerupUserSettingsDefaults();
    }

    editPowerupUserSettingsInChat = (parent: Context, pid: number, cid: number, uid: number, settings: PowerupChatUserSettings) => {
        return inTx(parent, async ctx => {
            let chatPowerup = await Store.ChatPowerup.findById(ctx, pid, cid);
            if (!chatPowerup || !chatPowerup.enabled) {
                return null;
            }
            chatPowerup.userSettings[uid] = settings;

            chatPowerup.invalidate();
            await chatPowerup.flush(ctx);

            EventBus.publish(`powerup_settings_change_${pid}_${cid}`, { uid, settings });
            return chatPowerup.userSettings[uid];
        });
    }

    private _getPowerupUserSettingsDefaults = (): PowerupChatUserSettings => {
        return {
            enabled: false,
        };
    }
}