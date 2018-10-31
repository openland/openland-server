import { keySelector } from 'foundationdb';
import { FEntity } from './FEntity';
import { FConnection } from './FConnection';
import { RangeOptions } from 'foundationdb/dist/lib/transaction';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { trace } from 'openland-log/trace';
import { tracer } from './utils/tracer';

export interface FContext {
    readonly isReadOnly: boolean;
    readonly isCompleted: boolean;
    markDirty(entity: FEntity, callback: (connection: FConnection) => Promise<void>): void;
    get(connection: FConnection, key: (string | number)[]): Promise<any | null>;
    range(connection: FConnection, key: (string | number)[], options?: RangeOptions): Promise<{ item: any, key: any[] }[]>;
    rangeAfter(connection: FConnection, prefix: (string | number)[], afterKey: (string | number)[], options?: RangeOptions): Promise<{ item: any, key: any[] }[]>;
    set(connection: FConnection, key: (string | number)[], value: any): Promise<void>;
    delete(connection: FConnection, key: (string | number)[]): Promise<void>;
}

export class FGlobalContext implements FContext {
    readonly isReadOnly: boolean = true;
    readonly isCompleted: boolean = false;
    async get(connection: FConnection, key: (string | number)[]) {
        return await trace(tracer, 'get', async () => {
            return await connection.fdb.get(FKeyEncoding.encodeKey(key));
        });
    }
    async range(connection: FConnection, key: (string | number)[], options?: RangeOptions) {
        return await trace(tracer, 'range', async () => {
            let res = await connection.fdb.getRangeAll(FKeyEncoding.encodeKey(key), undefined, options);
            return res.map((v) => ({ item: v[1] as any, key: FKeyEncoding.decodeKey(v[0]) }));
        });
    }
    async rangeAfter(connection: FConnection, prefix: (string | number)[], afterKey: (string | number)[], options?: RangeOptions) {
        return await trace(tracer, 'rangeAfter', async () => {
            let reversed = (options && options.reverse) ? true : false;
            let start = reversed ? FKeyEncoding.firstKeyInSubspace(prefix) : keySelector.firstGreaterThan(FKeyEncoding.encodeKey(afterKey));
            let end = reversed ? keySelector.lastLessOrEqual(FKeyEncoding.encodeKey(afterKey)) : FKeyEncoding.lastKeyInSubspace(prefix);
            let res = await connection.fdb.getRangeAll(start, end, options);
            return res.map((v) => ({ item: v[1] as any, key: FKeyEncoding.decodeKey(v[0]) }));
        });
    }

    async set(connection: FConnection, key: (string | number)[], value: any) {
        console.warn('Set outside of transaction!');
        return await trace(tracer, 'set', async () => {
            return await connection.fdb.set(FKeyEncoding.encodeKey(key), value);
        });
    }
    async delete(connection: FConnection, key: (string | number)[]) {
        return await trace(tracer, 'delete', async () => {
            return await connection.fdb.clear(FKeyEncoding.encodeKey(key));
        });
    }
    markDirty(entity: FEntity, callback: (connection: FConnection) => void) {
        throw Error('Trying to write to read-only context');
    }
}