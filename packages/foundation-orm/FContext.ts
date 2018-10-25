import { FEntity } from './FEntity';
import { FConnection } from './FConnection';
import { RangeOptions } from 'foundationdb/dist/lib/transaction';

export interface FContext {
    readonly isReadOnly: boolean;
    readonly isCompleted: boolean;
    markDirty(entity: FEntity, callback: (connection: FConnection) => Promise<void>): void;
    get(connection: FConnection, key: (string | number)[]): Promise<any | null>;
    range(connection: FConnection, key: (string | number)[], options?: RangeOptions): Promise<any[]>;
    // rangeAfter(connection: FConnection, key: (string | number)[], after: (string | number)[], options?: RangeOptions): Promise<any[]>;
    set(connection: FConnection, key: (string | number)[], value: any): Promise<void>;
    delete(connection: FConnection, key: (string | number)[]): Promise<void>;
}

export class FGlobalContext implements FContext {
    readonly isReadOnly: boolean = true;
    readonly isCompleted: boolean = false;
    get(connection: FConnection, key: (string | number)[]) {
        return connection.fdb.get(key);
    }
    async range(connection: FConnection, key: (string | number)[], options?: RangeOptions) {
        let res = await connection.fdb.getRangeAll(key, undefined, options);
        return res.map((v) => v[1]);
    }

    // async rangeAfter(connection: FConnection, key: (string | number)[], after: (string | number)[], options?: RangeOptions) {
    //     let res = await connection.fdb.getRangeAll(fdb.keySelector.g, undefined, options);
    // }

    set(connection: FConnection, key: (string | number)[], value: any) {
        console.warn('Set outside of transaction!');
        return connection.fdb.set(key, value);
    }
    delete(connection: FConnection, key: (string | number)[]) {
        return connection.fdb.clear(key);
    }
    markDirty(entity: FEntity, callback: (connection: FConnection) => void) {
        throw Error('Trying to write to read-only context');
    }
}