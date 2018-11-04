import { FConnection } from './FConnection';

export class FDirectory {
    readonly connection: FConnection;
    constructor(connection: FConnection, key: (string | number | boolean)[]) {
        this.connection = connection;
    }
}