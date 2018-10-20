import { FEntity } from './FEntity';
import { FConnection } from './FConnection';

export interface FContext {
    readonly isReadOnly: boolean;
    readonly isCompleted: boolean;
    markDirty(entity: FEntity, callback: (connection: FConnection) => Promise<void>): void;
    get(connection: FConnection, ...key: (string | number)[]): Promise<any | null>;
    range(connection: FConnection, limit: number, ...key: (string | number)[]): Promise<any[]>;
    set(connection: FConnection, value: any, ...key: (string | number)[]): Promise<void>;
    delete(connection: FConnection, ...key: (string | number)[]): Promise<void>;
}

export class FGlobalContext implements FContext {
    readonly isReadOnly: boolean = true;
    readonly isCompleted: boolean = false;
    get(connection: FConnection, ...key: (string | number)[]) {
        return connection.fdb.get(key);
    }
    async range(connection: FConnection, limit: number, ...key: (string | number)[]) {
        let res = await connection.fdb.getRangeAll(key, undefined, { limit });
        return res.map((v) => v[1]);
    }
    set(connection: FConnection, value: any, ...key: (string | number)[]) {
        return connection.fdb.set(key, value);
    }
    delete(connection: FConnection, ...key: (string | number)[]) {
        return connection.fdb.clear(key);
    }
    markDirty(entity: FEntity, callback: (connection: FConnection) => void) {
        throw Error('Trying to write to read-only context');
    }
}