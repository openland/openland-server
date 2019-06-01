import { Context } from 'openland-utils/Context';
import { FRangeOptions } from './FRangeOptions';
import { FTransformer } from './FTransformer';

export interface FOperations<K = Buffer, V = Buffer> {

    withKeyEncoding<K2>(keyTf: FTransformer<K, K2>): FOperations<K2, V>;
    withValueEncoding<V2>(valueTf: FTransformer<V, V2>): FOperations<K, V2>;
    subspace(key: K): FOperations<K, V>;

    get(ctx: Context, key: K): Promise<V | null>;

    range(ctx: Context, key: K, opts?: FRangeOptions<K>): Promise<{ key: K, value: V }[]>;

    set(ctx: Context, key: K, value: V): void;

    delete(ctx: Context, key: K): void;

    add(ctx: Context, key: K, value: V): void;

    or(ctx: Context, key: K, value: V): void;

    xor(ctx: Context, key: K, value: V): void;
}