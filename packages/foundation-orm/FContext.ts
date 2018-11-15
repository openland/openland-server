import { keySelector } from 'foundationdb';
import { FEntity } from './FEntity';
import { FConnection } from './FConnection';
import { RangeOptions } from 'foundationdb/dist/lib/transaction';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { trace } from 'openland-log/trace';
import { tracer, logger } from './utils/tracer';
import { createEmptyContext } from 'openland-utils/Context';

export interface FContext {
    readonly isReadOnly: boolean;
    readonly isCompleted: boolean;
    markDirty(entity: FEntity, callback: (connection: FConnection) => Promise<void>): void;
    get(connection: FConnection, key: Buffer): Promise<any | null>;
    range(connection: FConnection, key: Buffer, options?: RangeOptions): Promise<{ item: any, key: Buffer }[]>;
    rangeAll(connection: FConnection, key: Buffer, options?: RangeOptions): Promise<any[]>;
    rangeAfter(connection: FConnection, prefix: (string | number)[], afterKey: (string | number)[], options?: RangeOptions): Promise<{ item: any, key: Buffer }[]>;
    set(connection: FConnection, key: Buffer, value: any): void;
    delete(connection: FConnection, key: Buffer): void;
    afterTransaction(callback: () => void): void;
}

export class FGlobalContext implements FContext {
    readonly isReadOnly: boolean = true;
    readonly isCompleted: boolean = false;
    async get(connection: FConnection, key: Buffer) {
        return await trace(tracer, 'get', async () => {
            logger.debug(createEmptyContext(), 'get');
            return await connection.fdb.get(key);
        });
    }
    async range(connection: FConnection, key: Buffer, options?: RangeOptions) {
        return await trace(tracer, 'range', async () => {
            logger.debug(createEmptyContext(), 'get-range');
            let res = await connection.fdb.getRangeAll(key, undefined, options);
            return res.map((v) => ({ item: v[1] as any, key: v[0] }));
        });
    }
    async rangeAll(connection: FConnection, key: Buffer, options?: RangeOptions) {
        return await trace(tracer, 'range', async () => {
            logger.debug(createEmptyContext(), 'get-range-all');
            let res = await connection.fdb.getRangeAll(key, undefined, options);
            return res.map((v) => (v[1] as any));
        });
    }
    async rangeAfter(connection: FConnection, prefix: (string | number)[], afterKey: (string | number)[], options?: RangeOptions) {
        return await trace(tracer, 'rangeAfter', async () => {
            logger.debug(createEmptyContext(), 'get-range-after');
            let reversed = (options && options.reverse) ? true : false;
            let start = reversed ? FKeyEncoding.firstKeyInSubspace(prefix) : keySelector.firstGreaterThan(FKeyEncoding.encodeKey(afterKey));
            let end = reversed ? FKeyEncoding.encodeKey(afterKey) : FKeyEncoding.lastKeyInSubspace(prefix);
            let res = await connection.fdb.getRangeAll(start, end, options);
            return res.map((v) => ({ item: v[1] as any, key: v[0] }));
        });
    }

    set(connection: FConnection, key: Buffer, value: any) {
        throw Error('Trying to write to read-only context');
    }
    delete(connection: FConnection, key: Buffer) {
        throw Error('Trying to write to read-only context');
    }
    markDirty(entity: FEntity, callback: (connection: FConnection) => void) {
        throw Error('Trying to write to read-only context');
    }
    afterTransaction(callback: () => void) {
        throw Error('Trying to write to read-only context');
    }
}