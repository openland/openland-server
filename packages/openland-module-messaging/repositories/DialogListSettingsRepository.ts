import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';
import {
    UserDialogListSettings,
    UserDialogListSettingsShape,
} from '../../openland-module-db/store';
import { injectable } from 'inversify';

@injectable()
export class DialogListSettingsRepository {
    getUserSettings = async (ctx: Context, uid: number): Promise<UserDialogListSettingsShape> => {
        let settings = await Store.UserDialogListSettings.findById(ctx, uid);
        if (!settings) {
            return {
                uid: uid,
                pinnedChats: []
            };
        }
        return settings;
    }

    pinChat = async (ctx: Context, uid: number, cid: number) => {
        let settings = await this.#getOrCreateSettings(ctx, uid);
        if (!settings.pinnedChats.includes(cid)) {
            settings.pinnedChats = [...settings.pinnedChats, cid];
            return true;
        }
        return false;
    }

    unpinChat = async (ctx: Context, uid: number, cid: number) => {
        let settings = await this.#getOrCreateSettings(ctx, uid);
        if (settings.pinnedChats.includes(cid)) {
            settings.pinnedChats = settings.pinnedChats.filter(a => a !== cid);
            return true;
        }
        return false;
    }

    editPinned = async (ctx: Context, uid: number, pinned: number[]) => {
        let settings = await this.#getOrCreateSettings(ctx, uid);
        if (settings.pinnedChats !== pinned) {
            settings.pinnedChats = pinned;
        }
    }

    #getOrCreateSettings = async (ctx: Context, uid: number): Promise<UserDialogListSettings> => {
        let settings = await Store.UserDialogListSettings.findById(ctx, uid);
        if (!settings) {
            return await Store.UserDialogListSettings.create(ctx, uid, {
                pinnedChats: []
            });
        }
        return settings;
    }
}