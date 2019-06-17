import { FWatch } from './FWatch';
import { Context } from '@openland/context';
import { FRangeOptions } from './FRangeOptions';
import { FTransformer } from './encoding/FTransformer';

export interface FSubspace<K = Buffer, V = Buffer> {

    withKeyEncoding<K2>(keyTf: FTransformer<K, K2>): FSubspace<K2, V>;
    withValueEncoding<V2>(valueTf: FTransformer<V, V2>): FSubspace<K, V2>;
    subspace(key: K): FSubspace<K, V>;

    //
    // Queries
    //

    get(ctx: Context, key: K): Promise<V | null>;
    range(ctx: Context, key: K, opts?: FRangeOptions<K>): Promise<{ key: K, value: V }[]>;

    //
    // Mutations
    //

    set(ctx: Context, key: K, value: V): void;
    clear(ctx: Context, key: K): void;
    add(ctx: Context, key: K, value: V): void;
    bitOr(ctx: Context, key: K, value: V): void;
    bitXor(ctx: Context, key: K, value: V): void;

    //
    // Watch
    //

    watch(ctx: Context, key: K): FWatch;
}