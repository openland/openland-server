import { Context } from '@openland/context';
import { encoders, Subspace, TupleItem } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';

const PREFIX_VERSION = 0;
const PREFIX_CHATS = 1;

export class UserChatsRepository {
    private readonly chatsSubspace: Subspace<TupleItem[], boolean>;
    private readonly versionSubspace: Subspace<TupleItem[], number>;

    constructor() {
        let directory = Store.UserChatsActiveDirectory;

        this.versionSubspace = directory
            .subspace(encoders.tuple.pack([PREFIX_VERSION]))
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.int32LE);

        this.chatsSubspace = directory
            .subspace(encoders.tuple.pack([PREFIX_CHATS]))
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean);
    }

    addChat(ctx: Context, uid: number, cid: number) {
        this.chatsSubspace.set(ctx, [uid, cid], true);
        this.versionSubspace.add(ctx, [uid], 1);
    }

    removeChat(ctx: Context, uid: number, cid: number) {
        this.chatsSubspace.clear(ctx, [uid, cid]);
        this.versionSubspace.add(ctx, [uid], 1);
    }

    async getChats(ctx: Context, uid: number) {
        return (await this.chatsSubspace.range(ctx, [uid])).map(v => v.key[1]);
    }

    async getVersion(ctx: Context, uid: number) {
        return await this.versionSubspace.get(ctx, [uid]) || 0;
    }
}