import { Context } from 'openland-utils/Context';

interface RangeOptions {
    after?: Buffer;
    limit?: number;
    reverse?: boolean;
}

export interface FOperations {

    get(ctx: Context, key: Buffer): Promise<Buffer | null>;

    range(ctx: Context, key: Buffer, opts?: RangeOptions): Promise<{ key: Buffer, value: Buffer }[]>;

    set(ctx: Context, key: Buffer, value: Buffer): void;

    delete(ctx: Context, key: Buffer): void;

    add(ctx: Context, key: Buffer, value: Buffer): void;

    or(ctx: Context, key: Buffer, value: Buffer): void;

    xor(ctx: Context, key: Buffer, value: Buffer): void;
}