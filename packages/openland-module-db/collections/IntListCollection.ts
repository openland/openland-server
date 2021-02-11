import { encoders, inTx, Subspace, TupleItem } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { RangeOptions } from '@openland/foundationdb/lib/Subspace';
import { cursorToTuple, tupleToCursor } from '@openland/foundationdb-entity/lib/indexes/utils';

const SUBSPACE_SORT_VALUE = 1;
const SUBSPACE_SORT_TIME = 2;
const SUBSPACE_COUNTER = 3;

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
            this.subspace.set(ctx, encoders.tuple.pack([...collection, SUBSPACE_SORT_TIME, now, val]), encoders.int32LE.pack(now));
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

    async range(ctx: Context, collection: TupleItem[], sort: 'time'|'value', opts?: { limit?: number, after?: string, reverse?: boolean}) {
        let _opts: RangeOptions = {
            ...opts,
            after: undefined,
            before: undefined
        };

        if (opts?.after) {
            _opts.after = encoders.tuple.pack([...collection, ...cursorToTuple(opts.after)]);
        }

        let queryLimit = _opts.limit ? _opts.limit + 1 : undefined;

        let res;
        if (sort === 'value') {
            res = await this.subspace.range(ctx, encoders.tuple.pack([...collection, SUBSPACE_SORT_VALUE]), {..._opts, limit: queryLimit});
        } else {
            res = await this.subspace.range(ctx, encoders.tuple.pack([...collection, SUBSPACE_SORT_TIME]), {..._opts, limit: queryLimit});
        }

        let values = res.map(v => {
            let key = encoders.tuple.unpack(v.key);
            return {
                value: key[key.length - 1] as number,
                date: encoders.int32LE.unpack(v.value),
            };
        });

        if (_opts.limit) {
            let items = values.slice(0, _opts.limit);
            let cursor;
            if (sort === 'value') {
                cursor = tupleToCursor([SUBSPACE_SORT_VALUE, items[items.length - 1].value]);
            } else {
                cursor = tupleToCursor([SUBSPACE_SORT_TIME, items[items.length - 1].date, items[items.length - 1].value]);
            }
            return {
                items,
                haveMore: values.length > _opts.limit,
                cursor
            };
        }

        return {
            items: values,
            haveMore: false
        };
    }

    async get(ctx: Context, collection: TupleItem[], value: number) {
        let ex = await this.subspace.get(ctx, encoders.tuple.pack([...collection, SUBSPACE_SORT_VALUE, value]));

        if (!ex) {
            return null;
        }
        return {
            value,
            date: encoders.int32LE.unpack(ex)
        };
    }
}