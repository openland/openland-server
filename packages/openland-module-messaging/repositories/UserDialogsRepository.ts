import { encoders } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { injectable } from 'inversify';
import { Store } from 'openland-module-db/FDB';
import { DialogNeedReindexEvent } from '../../openland-module-db/store';

@injectable()
export class UserDialogsRepository {

    private readonly subspace = Store.UserDialogIndexDirectory
        .withKeyEncoding(encoders.tuple)
        .withValueEncoding(encoders.json);

    bumpDialog = (ctx: Context, uid: number, cid: number, date: number) => {
        this.subspace
            .set(ctx, [uid, cid], { date });
        Store.DialogIndexEventStore.post(ctx, DialogNeedReindexEvent.create({ uid, cid }));
    }

    removeDialog = (ctx: Context, uid: number, cid: number) => {
        this.subspace
            .clear(ctx, [uid, cid]);
        Store.DialogIndexEventStore.post(ctx, DialogNeedReindexEvent.create({ uid, cid }));
    }

    loadUserDialogs = async (ctx: Context, uid: number, after: number) => {
        return (await this.subspace
            .range(ctx, [uid], { after: [uid, after], limit: 500 }))
            .map((v) => v.key[1] as number);
    }

    findUserDialogs = async (ctx: Context, uid: number): Promise<{ cid: number, date: number }[]> => {
        return (await this.subspace
            .range(ctx, [uid])).map((v) => ({ cid: v.key[1] as number, date: v.value.date }));
    }

    hasActiveDialog = async (ctx: Context, uid: number, cid: number) => {
        return !!(await this.subspace
            .get(ctx, [uid, cid]));
    }

    findAnyUserDialog = async (ctx: Context, uid: number): Promise<number | null> => {
        let r = (await this.subspace
            .range(ctx, [uid], { limit: 1 }));
        if (r.length > 0) {
            return r[0].key[1] as number;
        } else {
            return null;
        }
    }
}