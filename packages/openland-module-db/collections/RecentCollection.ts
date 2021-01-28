import { Context } from '@openland/context';
import { encoders, Subspace, TupleItem } from '@openland/foundationdb';
import { CachedSubspace } from 'openland-module-db/CachedSubspace';
import { inTxLock } from 'openland-module-db/inTxLock';

function getHashedKey(prefix: Buffer, collection: TupleItem[]) {
    return encoders.tuple.pack([prefix, ...collection]).toString('hex');
}

const SUBSPACE_LATEST = 0;
const SUBSPACE_RECENTS = 1;
const ZERO = Buffer.from([]);

export class RecentCollection {
    readonly subspace: Subspace;
    private latest: CachedSubspace<number>;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
        this.latest = new CachedSubspace(this.subspace.subspace(encoders.tuple.pack([SUBSPACE_LATEST])), (src) => encoders.int32BE.pack(src), (src) => encoders.int32LE.unpack(src));
    }

    async range(ctx: Context, collection: TupleItem[], limit: number, after?: { key: number, date: number }) {
        let lockKey = getHashedKey(this.subspace.prefix, collection);
        return await inTxLock(ctx, lockKey, async () => {
            let res = await this.subspace.range(ctx, encoders.tuple.pack([SUBSPACE_RECENTS, ...collection]), { after: after ? encoders.tuple.pack([SUBSPACE_RECENTS, ...collection, after.date, after.key]) : undefined, limit });
            return res.map((v) => {
                let t = encoders.tuple.unpack(v.key);
                let key = t[t.length - 1] as number;
                let date = t[t.length - 2] as number;
                return {
                    key,
                    date
                };
            });
        });
    }

    async add(ctx: Context, collection: TupleItem[], args: { key: number, date: number }) {
        let key = [...collection, args.key];
        let lockKey = getHashedKey(this.subspace.prefix, collection);
        await inTxLock(ctx, lockKey, async () => {
            let latest = await this.latest.read(ctx, key);
            this.latest.write(ctx, key, args.date);

            if (latest) {
                this.subspace.clear(ctx, encoders.tuple.pack([SUBSPACE_RECENTS, ...collection, latest, args.key]));
            }
            this.subspace.set(ctx, encoders.tuple.pack([SUBSPACE_RECENTS, ...collection, args.date, args.key]), ZERO);
        });
    }

    async remove(ctx: Context, collection: TupleItem[], key: number) {
        let recordKey = [...collection, key];
        let lockKey = getHashedKey(this.subspace.prefix, collection);
        await inTxLock(ctx, lockKey, async () => {
            let latest = await this.latest.read(ctx, collection);
            if (latest) {
                this.latest.write(ctx, recordKey, null);
                this.subspace.clear(ctx, encoders.tuple.pack([SUBSPACE_RECENTS, ...collection, latest, key]));
            }
        });
    }
}