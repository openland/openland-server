import { FEntity } from './FEntity';
import { FConnection } from './FConnection';

export interface FContext {
    readonly connection: FConnection;
    readonly isReadOnly: boolean;
    markDirty(entity: FEntity, value: any): void;
}

export class FGlobalContext implements FContext {
    readonly connection: FConnection;
    readonly isReadOnly: boolean = true;

    constructor(connection: FConnection) {
        this.connection = connection;
    }

    markDirty(entity: FEntity, value: any) {
        throw Error('Trying to write to read-only context');
    }
}