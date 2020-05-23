import { inject, injectable } from 'inversify';
import { PowerupInput, PowerupsRepository, PowerupChatUserSettings } from './PowerupsRepository';
import { Context } from '@openland/context';
import { ChatPowerup } from '../openland-module-db/store';

@injectable()
export class PowerupsModule {
    @inject('PowerupsRepository')
    private readonly repo!: PowerupsRepository;

    public start = async () => {
        //
    }

    createPowerup = (parent: Context, input: PowerupInput) => {
        return this.repo.createPowerup(parent, input);
    }

    editPowerup = (parent: Context, id: number, input: PowerupInput) => {
        return this.repo.editPowerup(parent, id, input);
    }

    findPowerups = async (parent: Context) => {
        return this.repo.findPowerups(parent);
    }

    findChatsWithPowerup = (parent: Context, uid: number, pid: number) => {
        return this.repo.findChatsWithPowerup(parent, uid, pid);
    }

    findPowerupsInChat = (parent: Context, cid: number) => {
        return this.repo.findPowerupsInChat(parent, cid);
    }

    getPowerup = (parent: Context, id: number) => {
        return this.repo.getPowerup(parent, id);
    }

    hasPowerup = (parent: Context, cid: number, pid: number) => {
        return this.repo.hasPowerup(parent, cid, pid);
    }

    getChatPowerup = async (parent: Context, cid: number, pid: number) => {
        return this.repo.getChatPowerup(parent, cid, pid);
    }

    addPowerupToChat = (parent: Context, pid: number, cid: number, uid: number) => {
        return this.repo.addPowerupToChat(parent, pid, cid, uid);
    }

    removePowerupFromChat = (parent: Context, pid: number, cid: number, uid: number) => {
        return this.repo.removePowerupFromChat(parent, pid, cid, uid);
    }

    getPowerupUserSettingsInChat = (parent: Context, pid: number, cid: number, uid: number) => {
        return this.repo.getPowerupUserSettingsInChat(parent, pid, cid, uid);
    }

    getPowerupUsersSettingsInChat = async (parent: Context, pid: number, cid: number) => {
        return this.repo.getPowerupUsersSettingsInChat(parent, pid, cid);
    }

    extractSettingsFromChatPowerup = (chatPowerup: ChatPowerup, uid: number) => {
        return this.repo.extractSettingsFromChatPowerup(chatPowerup, uid);
    }

    editPowerupUserSettingsInChat = (parent: Context, pid: number, cid: number, uid: number, settings: PowerupChatUserSettings) => {
        return this.repo.editPowerupUserSettingsInChat(parent, pid, cid, uid, settings);
    }
}