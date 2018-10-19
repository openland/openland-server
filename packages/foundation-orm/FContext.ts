import { FEntity } from './FEntity';
import { FConnection } from './FConnection';

export interface FContext {
    readonly isReadOnly: boolean;
    markDirty(entity: FEntity, callback: (connection: FConnection) => Promise<void>): void;
    get(connection: FConnection, ...key: (string | number)[]): Promise<any | null>;
    set(connection: FConnection, value: any, ...key: (string | number)[]): Promise<void>;
}

export class FGlobalContext implements FContext {
    readonly isReadOnly: boolean = true;
    get(connection: FConnection, ...key: (string | number)[]) {
        return connection.fdb.get(key);
    }
    set(connection: FConnection, value: any, ...key: (string | number)[]) {
        return connection.fdb.set(key, value);
    }
    markDirty(entity: FEntity, callback: (connection: FConnection) => void) {
        throw Error('Trying to write to read-only context');
    }
}