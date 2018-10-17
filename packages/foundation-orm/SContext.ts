import { SEntity } from './SEntity';
import { SConnection } from './SConnection';

export interface SContext {
    readonly connection: SConnection;
    readonly isReadOnly: boolean;
    markDirty(entity: SEntity, value: any): void;
}

export class SGlobalContext implements SContext {
    readonly connection: SConnection;
    readonly isReadOnly: boolean = true;

    constructor(connection: SConnection) {
        this.connection = connection;
    }
    
    markDirty(entity: SEntity, value: any) {
        throw Error('Trying to write to read-only context');
    }
}