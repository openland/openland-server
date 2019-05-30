import { keySelector, encoders } from 'foundationdb';
import { FEntity } from './FEntity';
import { FConnection } from './FConnection';
import { RangeOptions } from 'foundationdb/dist/lib/transaction';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { tracer } from './utils/tracer';
import { Context } from 'openland-utils/Context';

export interface FContext {
    readonly isReadOnly: boolean;
    readonly isCompleted: boolean;

    markDirty(parent: Context, entity: FEntity, callback: (ctx: Context) => Promise<void>): void;
    get(context: Context, connection: FConnection, key: Buffer): Promise<any | null>;
    range(context: Context, connection: FConnection, key: Buffer, options?: RangeOptions): Promise<{ item: any, key: Buffer }[]>;
    rangeAll(context: Context, connection: FConnection, key: Buffer, options?: RangeOptions): Promise<any[]>;
    rangeAfter(context: Context, connection: FConnection, prefix: (string | number)[], afterKey: (string | number)[], options?: RangeOptions): Promise<{ item: any, key: Buffer }[]>;
    set(context: Context, connection: FConnection, key: Buffer, value: any): void;
    delete(context: Context, connection: FConnection, key: Buffer): void;
    afterTransaction(callback: () => void): void;

    atomicSet(context: Context, connection: FConnection, key: Buffer, value: number): void;
    atomicGet(context: Context, connection: FConnection, key: Buffer): Promise<number | null>;
}

export class FGlobalContext implements FContext {
    readonly isReadOnly: boolean = true;
    readonly isCompleted: boolean = false;

    async get(parent: Context, connection: FConnection, key: Buffer) {
        return await tracer.trace(parent, 'get', async (ctx) => {
            // logger.debug(ctx, 'get');
            let r = await connection.fdb.get(key);
            if (r) {
                return encoders.json.unpack(r);
            } else {
                return null;
            }
        });
    }
    async range(parent: Context, connection: FConnection, key: Buffer, options?: RangeOptions) {
        return await tracer.trace(parent, 'range', async (ctx) => {
            // logger.debug(ctx, 'get-range');
            let res = await connection.fdb.getRangeAll(key, undefined, options);
            return res.map((v) => ({ item: encoders.json.unpack(v[1]), key: v[0] }));
        });
    }
    async rangeAll(parent: Context, connection: FConnection, key: Buffer, options?: RangeOptions) {
        return await tracer.trace(parent, 'range', async (ctx) => {
            // logger.debug(ctx, 'get-range-all');
            let res = await connection.fdb.getRangeAll(key, undefined, options);
            return res.map((v) => encoders.json.unpack(v[1]));
        });
    }
    async rangeAfter(parent: Context, connection: FConnection, prefix: (string | number)[], afterKey: (string | number)[], options?: RangeOptions) {
        return await tracer.trace(parent, 'rangeAfter', async (ctx) => {
            // logger.debug(ctx, 'get-range-after');
            let reversed = (options && options.reverse) ? true : false;
            let start = reversed ? FKeyEncoding.firstKeyInSubspace(prefix) : keySelector.firstGreaterThan(FKeyEncoding.encodeKey(afterKey));
            let end = reversed ? FKeyEncoding.encodeKey(afterKey) : FKeyEncoding.lastKeyInSubspace(prefix);
            let res = await connection.fdb.getRangeAll(start, end, options);
            return res.map((v) => ({ item: encoders.json.unpack(v[1]), key: v[0] }));
        });
    }
    set(context: Context, connection: FConnection, key: Buffer, value: any) {
        throw Error('Trying to write to read-only context');
    }
    delete(context: Context, connection: FConnection, key: Buffer) {
        throw Error('Trying to write to read-only context');
    }
    markDirty(parent: Context, entity: FEntity, callback: (ctx: Context) => void) {
        throw Error('Trying to write to read-only context');
    }
    afterTransaction(callback: () => void) {
        throw Error('Trying to write to read-only context');
    }

    //
    // Atomic
    //

    async atomicGet(context: Context, connection: FConnection, key: Buffer) {
        return await tracer.trace(context, 'atomicGet', async (ctx) => {
            // logger.debug(ctx, 'get');
            let r = await connection.fdb.get(key);
            if (r) {
                return encoders.int32BE.unpack(r);
            } else {
                return null;
            }
        });
    }

    atomicSet(context: Context, connection: FConnection, key: Buffer, value: number) {
        throw Error('Trying to write to read-only context');
    }
}