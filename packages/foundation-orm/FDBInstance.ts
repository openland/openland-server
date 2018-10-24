import { FConnection } from './FConnection';

export class FDBInstance {
    readonly connection: FConnection;
    constructor(connection: FConnection) {
        this.connection = connection;
    }
}