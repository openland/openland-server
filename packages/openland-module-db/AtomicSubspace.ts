import { Context } from '@openland/context';
import { encoders, Subspace, TupleItem } from '@openland/foundationdb';

export class AtomicSubspace {
    readonly subpsace: Subspace;

    constructor(subpsace: Subspace) {
        this.subpsace = subpsace;
    }

    add(ctx: Context, key: TupleItem[], value: number) {
        this.subpsace.add(ctx, encoders.tuple.pack(key), encoders.int32LE.pack(value));
    }

    set(ctx: Context, key: TupleItem[], value: number) {
        this.subpsace.set(ctx, encoders.tuple.pack(key), encoders.int32LE.pack(value));
    }

    async get(ctx: Context, key: TupleItem[]) {
        let ex = await this.subpsace.get(ctx, encoders.tuple.pack(key));
        if (ex) {
            return encoders.int32LE.unpack(ex);
        }
        return 0;
    }
}