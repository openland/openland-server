import { UserStateRepository } from './UserStateRepository';
import { Context } from '@openland/context';
import { injectable } from 'inversify';
import { Store } from 'openland-module-db/FDB';
import { lazyInject } from 'openland-modules/Modules.container';

@injectable()
export class UserDialogsRepository {

    @lazyInject('UserStateRepository') userState!: UserStateRepository;

    bumpDialog = async (ctx: Context, uid: number, cid: number, date: number) => {
        let local = await this.userState.getUserDialogState(ctx, uid, cid);
        local.date = date;
    }

    removeDialog = async (ctx: Context, uid: number, cid: number) => {
        let local = await this.userState.getUserDialogState(ctx, uid, cid);
        local.date = null;
    }

    findUserDialogs = async (ctx: Context, uid: number): Promise<{ cid: number, date: number }[]> => {
        return (await Store.UserDialog.user.findAll(ctx, uid)).filter((a) => !!a.date).map((v) => ({ cid: v.cid, date: v.date! }));
    }

    findAnyUserDialog = async (ctx: Context, uid: number): Promise<number | null> => {
        let r = await Store.UserDialog.user.query(ctx, uid, { limit: 1 });
        if (r.items.length > 0) {
            return r.items[0].cid;
        } else {
            return null;
        }
    }
}