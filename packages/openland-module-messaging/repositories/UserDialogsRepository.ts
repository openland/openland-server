import { encoders } from '@openland/foundationdb';
import { UserStateRepository } from './UserStateRepository';
import { Context } from '@openland/context';
import { injectable } from 'inversify';
import { Store } from 'openland-module-db/FDB';
import { lazyInject } from 'openland-modules/Modules.container';
import { DialogNeedReindexEvent } from '../../openland-module-db/store';

@injectable()
export class UserDialogsRepository {

    @lazyInject('UserStateRepository') userState!: UserStateRepository;

    bumpDialog = (ctx: Context, uid: number, cid: number, date: number) => {
        Store.UserDialogIndexDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json)
            .set(ctx, [uid, cid], { date });
        Store.DialogIndexEventStore.post(ctx, DialogNeedReindexEvent.create({ uid, cid }));
    }

    removeDialog = (ctx: Context, uid: number, cid: number) => {
        Store.UserDialogIndexDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json)
            .clear(ctx, [uid, cid]);
        Store.DialogIndexEventStore.post(ctx, DialogNeedReindexEvent.create({ uid, cid }));
    }

    loadUserDialogs = async (ctx: Context, uid: number, after: number) => {
        return (await Store.UserDialogIndexDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json)
            .range(ctx, [uid], { after: [uid, after], limit: 500 }))
            .map((v) => v.key[1] as number);
    }

    findUserDialogs = async (ctx: Context, uid: number): Promise<{ cid: number, date: number }[]> => {
        return (await Store.UserDialogIndexDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json)
            .range(ctx, [uid])).map((v) => ({ cid: v.key[1] as number, date: v.value.date }));
    }

    hasActiveDialog = async (ctx: Context, uid: number, cid: number) => {
        return !!(await Store.UserDialogIndexDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json)
            .get(ctx, [uid, cid]));
    }

    findAnyUserDialog = async (ctx: Context, uid: number): Promise<number | null> => {
        let r = (await Store.UserDialogIndexDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json)
            .range(ctx, [uid], { limit: 1 }));
        if (r.length > 0) {
            return r[0].key[1] as number;
        } else {
            return null;
        }
    }
}