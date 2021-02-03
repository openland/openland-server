import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { Subspace, TupleItem, encoders } from '@openland/foundationdb';

export class UserChatsActiveRepository {
    private readonly subspace: Subspace<TupleItem[], boolean>;

    constructor() {
        this.subspace = Store.UserChatsAllIndexDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean);
    }

    addChat(ctx: Context, uid: number, cid: number) {
        this.subspace.set(ctx, [uid, cid], true);
    }

    removeChat(ctx: Context, uid: number, cid: number) {
        this.subspace.clear(ctx, [uid, cid]);
    }

    loadChats = async (ctx: Context, uid: number, after: number, limit: number) => {
        return (await this.subspace
            .range(ctx, [uid], { after: [uid, after], limit }))
            .map((v) => v.key[1] as number);
    }
}