import { encoders, inTx, Subspace, TupleItem } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { RangeOptions } from '@openland/foundationdb/lib/Subspace';

const SUBSPACE_SORT_VALUE = 1;
const SUBSPACE_SORT_TIME = 2;
const SUBSPACE_COUNTER = 3;

const ZERO = Buffer.from([]);
const PLUS_ONE = encoders.int32LE.pack(1);
const MINUS_ONE = encoders.int32LE.pack(-1);

export class IntListCollection {
    readonly subspace: Subspace;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
    }

    async add(parent: Context, collection: TupleItem[], val: number) {
        await inTx(parent, async ctx => {
            let now = Math.floor(Date.now() / 1000);
            this.subspace.set(ctx, encoders.tuple.pack([...collection, SUBSPACE_SORT_VALUE, val]), encoders.int32LE.pack(now));
            this.subspace.set(ctx, encoders.tuple.pack([...collection, SUBSPACE_SORT_TIME, now, val]), ZERO);
            this.subspace.add(ctx, encoders.tuple.pack([...collection, SUBSPACE_COUNTER]), PLUS_ONE);
        });
    }

    async remove(parent: Context, collection: TupleItem[], val: number) {
        await inTx(parent, async ctx => {
            let ex = await this.subspace.get(ctx, encoders.tuple.pack([...collection, SUBSPACE_SORT_VALUE, val]));
            if (!ex) {
                return;
            }
            let createdAt = encoders.int32LE.unpack(ex);
            this.subspace.clear(ctx, encoders.tuple.pack([...collection, SUBSPACE_SORT_VALUE, val]));
            this.subspace.clear(ctx, encoders.tuple.pack([...collection, SUBSPACE_SORT_TIME, createdAt, val]));
            this.subspace.add(ctx, encoders.tuple.pack([...collection, SUBSPACE_COUNTER]), MINUS_ONE);
        });
    }

    async count(ctx: Context, collection: TupleItem[]) {
        let val = await this.subspace.get(ctx, encoders.tuple.pack([...collection, SUBSPACE_COUNTER]));
        if (!val) {
            return 0;
        }
        return encoders.int32LE.unpack(val);
    }

    async get(ctx: Context, collection: TupleItem[], sort: 'time'|'value', opts?: RangeOptions<number>) {
        let _opts: RangeOptions = {
            ...opts,
            after: opts?.after ? encoders.int32LE.pack(opts.after) : undefined,
            before: opts?.before ? encoders.int32LE.pack(opts.before) : undefined,
        };

        if (sort === 'value') {
            let res = await this.subspace.range(ctx, encoders.tuple.pack([...collection, SUBSPACE_SORT_VALUE]), _opts);
            return res.map(v => {
                let key = encoders.tuple.unpack(v.key);
                return key[key.length - 1];
            });
        } else {
            let res = await this.subspace.range(ctx, encoders.tuple.pack([...collection, SUBSPACE_SORT_TIME]), _opts);
            return res.map(v => {
                let key = encoders.tuple.unpack(v.key);
                return key[key.length - 1];
            });
        }
    }
}