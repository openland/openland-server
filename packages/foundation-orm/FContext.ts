import { keySelector } from 'foundationdb';
import { FEntity } from './FEntity';
import { FConnection } from './FConnection';
import { RangeOptions } from 'foundationdb/dist/lib/transaction';
import { FKeyEncoding } from './utils/FKeyEncoding';

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
    get(connection: FConnection, key: (string | number)[]) {
        return connection.fdb.get(FKeyEncoding.encodeKey(key));
    }
    async range(connection: FConnection, key: (string | number)[], options?: RangeOptions) {
        let res = await connection.fdb.getRangeAll(FKeyEncoding.encodeKey(key), undefined, options);
        return res.map((v) => ({ item: v[1] as any, key: FKeyEncoding.decodeKey(v[0]) }));
    }
    async rangeAfter(connection: FConnection, prefix: (string | number)[], afterKey: (string | number)[], options?: RangeOptions) {
        let start = keySelector.firstGreaterThan(FKeyEncoding.encodeKey(afterKey));
        let end = FKeyEncoding.lastKeyInSubspace(prefix);
        let res = await connection.fdb.getRangeAll(start, end, options);
        return res.map((v) => ({ item: v[1] as any, key: FKeyEncoding.decodeKey(v[0]) }));
    }

    set(connection: FConnection, key: (string | number)[], value: any) {
        console.warn('Set outside of transaction!');
        return connection.fdb.set(FKeyEncoding.encodeKey(key), value);
    }
    delete(connection: FConnection, key: (string | number)[]) {
        return connection.fdb.clear(FKeyEncoding.encodeKey(key));
    }
    markDirty(entity: FEntity, callback: (connection: FConnection) => void) {
        throw Error('Trying to write to read-only context');
    }
}