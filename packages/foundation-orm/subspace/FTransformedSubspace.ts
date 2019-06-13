import { FWatch } from './../FWatch';
import { FSubspace } from 'foundation-orm/FSubspace';
import { Context } from '@openland/context';
import { FTransformer } from 'foundation-orm/encoding/FTransformer';
import { FRangeOptions } from 'foundation-orm/FRangeOptions';
import { FEncoders } from 'foundation-orm/encoding/FEncoders';

export class FTransformedSubspace<K, V, SK, SV> implements FSubspace<K, V> {

    readonly ops: FSubspace<SK, SV>;
    readonly keyTf: FTransformer<SK, K>;
    readonly valTf: FTransformer<SV, V>;

    constructor(ops: FSubspace<SK, SV>, keyTf: FTransformer<SK, K>, valTf: FTransformer<SV, V>) {
        this.ops = ops;
        this.keyTf = keyTf;
        this.valTf = valTf;
    }

    withKeyEncoding<K2>(keyTf: FTransformer<K, K2>): FSubspace<K2, V> {
        return new FTransformedSubspace<K2, V, K, V>(this, keyTf, FEncoders.id<V>());
    }
    withValueEncoding<V2>(valueTf: FTransformer<V, V2>): FSubspace<K, V2> {
        return new FTransformedSubspace<K, V2, K, V>(this, FEncoders.id<K>(), valueTf);
    }

    subspace(key: K): FSubspace<K, V> {
        return new FTransformedSubspace(this.ops.subspace(this.keyTf.pack(key)), this.keyTf, this.valTf);
    }

    async get(ctx: Context, key: K): Promise<V | null> {
        let res = await this.ops.get(ctx, this.keyTf.pack(key));
        if (res) {
            return this.valTf.unpack(res);
        } else {
            return null;
        }
    }

    async range(ctx: Context, key: K, opts?: FRangeOptions<K>): Promise<{ key: K, value: V }[]> {
        let opts2: FRangeOptions<SK> | undefined = undefined;
        if (opts) {
            opts2 = {
                after: opts.after ? this.keyTf.pack(opts.after) : undefined,
                limit: opts.limit,
                reverse: opts.reverse
            };
        }
        let res = await this.ops.range(ctx, this.keyTf.pack(key), opts2);
        return res.map((v) => ({ key: this.keyTf.unpack(v.key), value: this.valTf.unpack(v.value) }));
    }

    set(ctx: Context, key: K, value: V) {
        this.ops.set(ctx, this.keyTf.pack(key), this.valTf.pack(value));
    }

    setWithVerstionstamp(ctx: Context, key: K, value: V) {
        this.ops.setWithVerstionstamp(ctx, this.keyTf.pack(key), this.valTf.pack(value));
    }

    setWithVerstionstampUnique(ctx: Context, key: K, value: V) {
        this.ops.setWithVerstionstampUnique(ctx, this.keyTf.pack(key), this.valTf.pack(value));
    }

    add(ctx: Context, key: K, value: V) {
        this.ops.add(ctx, this.keyTf.pack(key), this.valTf.pack(value));
    }

    xor(ctx: Context, key: K, value: V) {
        this.ops.xor(ctx, this.keyTf.pack(key), this.valTf.pack(value));
    }

    or(ctx: Context, key: K, value: V) {
        this.ops.xor(ctx, this.keyTf.pack(key), this.valTf.pack(value));
    }

    delete(ctx: Context, key: K) {
        this.ops.delete(ctx, this.keyTf.pack(key));
    }

    watch(ctx: Context, key: K): FWatch {
        return this.ops.watch(ctx, this.keyTf.pack(key));
    }
}