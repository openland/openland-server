import { Context } from '@openland/context';
import { encoders, Subspace, TupleItem } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';

const PREFIX_VERSION = 0;
const PREFIX_GROUPS = 1;

export class UserGroupsRepository {
    private readonly groupsSubspace: Subspace<TupleItem[], boolean>;
    private readonly versionSubspace: Subspace<TupleItem[], number>;

    constructor() {
        let directory = Store.UserChatsActiveDirectory;

        this.versionSubspace = directory
            .subspace(encoders.tuple.pack([PREFIX_VERSION]))
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.int32LE);

        this.groupsSubspace = directory
            .subspace(encoders.tuple.pack([PREFIX_GROUPS]))
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean);
    }

    addGroup(ctx: Context, uid: number, cid: number) {
        this.groupsSubspace.set(ctx, [uid, cid], true);
        this.versionSubspace.add(ctx, [uid], 1);
    }

    removeGroup(ctx: Context, uid: number, cid: number) {
        this.groupsSubspace.clear(ctx, [uid, cid]);
        this.versionSubspace.add(ctx, [uid], 1);
    }

    async getGroups(ctx: Context, uid: number) {
        return (await this.groupsSubspace.range(ctx, [uid])).map(v => v.key[1] as number);
    }

    async getVersion(ctx: Context, uid: number) {
        return await this.versionSubspace.get(ctx, [uid]) || 0;
    }

    async watchVersion(ctx: Context, uid: number) {
        return this.versionSubspace.watch(ctx, [uid]);
    }
}