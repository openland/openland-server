import { keySelector } from 'foundationdb';
import { FEntity } from './FEntity';
import { FConnection } from './FConnection';
import { RangeOptions } from 'foundationdb/dist/lib/transaction';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { tracer, logger } from './utils/tracer';
import { Context } from 'openland-utils/Context';

export interface FContext {
    readonly isReadOnly: boolean;
    readonly isCompleted: boolean;
    markDirty(parent: Context, entity: FEntity, callback: (connection: FConnection) => Promise<void>): void;
    get(context: Context, connection: FConnection, key: Buffer): Promise<any | null>;
    range(context: Context, connection: FConnection, key: Buffer, options?: RangeOptions): Promise<{ item: any, key: Buffer }[]>;
    rangeAll(context: Context, connection: FConnection, key: Buffer, options?: RangeOptions): Promise<any[]>;
    rangeAfter(context: Context, connection: FConnection, prefix: (string | number)[], afterKey: (string | number)[], options?: RangeOptions): Promise<{ item: any, key: Buffer }[]>;
    set(context: Context, connection: FConnection, key: Buffer, value: any): void;
    delete(context: Context, connection: FConnection, key: Buffer): void;
    afterTransaction(callback: () => void): void;
}

export class FGlobalContext implements FContext {
    readonly isReadOnly: boolean = true;
    readonly isCompleted: boolean = false;

    async get(parent: Context, connection: FConnection, key: Buffer) {
        return await tracer.trace(parent, 'get', async (ctx) => {
            logger.debug(ctx, 'get');
            return await connection.fdb.get(key);
        });
    }
    async range(parent: Context, connection: FConnection, key: Buffer, options?: RangeOptions) {
        return await tracer.trace(parent, 'range', async (ctx) => {
            logger.debug(ctx, 'get-range');
            let res = await connection.fdb.getRangeAll(key, undefined, options);
            return res.map((v) => ({ item: v[1] as any, key: v[0] }));
        });
    }
    async rangeAll(parent: Context, connection: FConnection, key: Buffer, options?: RangeOptions) {
        return await tracer.trace(parent, 'range', async (ctx) => {
            logger.debug(ctx, 'get-range-all');
            let res = await connection.fdb.getRangeAll(key, undefined, options);
            return res.map((v) => (v[1] as any));
        });
    }
    async rangeAfter(parent: Context, connection: FConnection, prefix: (string | number)[], afterKey: (string | number)[], options?: RangeOptions) {
        return await tracer.trace(parent, 'rangeAfter', async (ctx) => {
            logger.debug(ctx, 'get-range-after');
            let reversed = (options && options.reverse) ? true : false;
            let start = reversed ? FKeyEncoding.firstKeyInSubspace(prefix) : keySelector.firstGreaterThan(FKeyEncoding.encodeKey(afterKey));
            let end = reversed ? FKeyEncoding.encodeKey(afterKey) : FKeyEncoding.lastKeyInSubspace(prefix);
            let res = await connection.fdb.getRangeAll(start, end, options);
            return res.map((v) => ({ item: v[1] as any, key: v[0] }));
        });
    }

    set(context: Context, connection: FConnection, key: Buffer, value: any) {
        throw Error('Trying to write to read-only context');
    }
    delete(context: Context, connection: FConnection, key: Buffer) {
        throw Error('Trying to write to read-only context');
    }
    markDirty(parent: Context, entity: FEntity, callback: (connection: FConnection) => void) {
        throw Error('Trying to write to read-only context');
    }
    afterTransaction(callback: () => void) {
        throw Error('Trying to write to read-only context');
    }
}