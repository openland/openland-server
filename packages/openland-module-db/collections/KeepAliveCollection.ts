import { encoders, Subspace, TupleItem } from '@openland/foundationdb';
import { Context } from '@openland/context';

export class KeepAliveCollection {
    readonly subspace: Subspace;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
    }

    keepAlive(ctx: Context, key: TupleItem[], timeout: number) {
        let now = Date.now();
        let lastSeen = Math.floor((now + timeout) / 1000);

        this.subspace.max(ctx, encoders.tuple.pack(key), encoders.int32LE.pack(lastSeen));
    }

    async getLastSeen(ctx: Context, key: TupleItem[]) {
        let lastSeen = await this.subspace.snapshotGet(ctx, encoders.tuple.pack(key));
        if (!lastSeen) {
            return null;
        }
        return encoders.int32LE.unpack(lastSeen);
    }

    async isAlive(ctx: Context, key: TupleItem[]) {
        let lastSeen = await this.subspace.snapshotGet(ctx, encoders.tuple.pack(key));
        if (!lastSeen) {
            return false;
        }
        let now = Math.floor(Date.now() / 1000);
        return encoders.int32LE.unpack(lastSeen) > now;
    }
}