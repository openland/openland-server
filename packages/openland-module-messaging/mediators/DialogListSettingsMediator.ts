import { Context } from '@openland/context';
import {
    UpdateDialogListSettingsChanged, UserDialogListSettingsShape,
} from '../../openland-module-db/store';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { DialogListSettingsRepository } from '../repositories/DialogListSettingsRepository';
import { Modules } from '../../openland-modules/Modules';

@injectable()
export class DialogListSettingsMediator {
    @lazyInject('DialogListSettingsRepository')
    private readonly repo!: DialogListSettingsRepository;

    getUserSettings = async (ctx: Context, uid: number): Promise<UserDialogListSettingsShape> => {
        return this.repo.getUserSettings(ctx, uid);
    }

    pinChat = async (ctx: Context, uid: number, cid: number) => {
        await Modules.Messaging.room.checkAccess(ctx, uid, cid);

        if (await this.repo.pinChat(ctx, uid, cid)) {
            await Modules.Events.postToCommon(ctx, uid, UpdateDialogListSettingsChanged.create({
                uid: uid
            }));
        }
    }

    unpinChat = async (ctx: Context, uid: number, cid: number) => {
        if (await this.repo.unpinChat(ctx, uid, cid)) {
            await Modules.Events.postToCommon(ctx, uid, UpdateDialogListSettingsChanged.create({
                uid: uid
            }));
        }
    }

    editPinned = async (ctx: Context, uid: number, pinned: number[]) => {
        await Promise.all(pinned.map(a => Modules.Messaging.room.checkAccess(ctx, uid, a)));

        await this.repo.editPinned(ctx, uid, pinned);
        await Modules.Events.postToCommon(ctx, uid, UpdateDialogListSettingsChanged.create({
            uid: uid
        }));
    }
}