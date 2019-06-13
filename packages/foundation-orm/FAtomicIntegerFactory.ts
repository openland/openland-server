import { FConnection } from './FConnection';
import { FDirectory } from './FDirectory';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { FAtomicInteger } from './FAtomicInteger';
import { FSubspace } from './FSubspace';
import { FTuple } from './encoding/FTuple';

export class FAtomicIntegerFactory {

    readonly connection: FConnection;
    readonly directory: FDirectory;
    readonly keySpace: FSubspace;

    constructor(name: string, connection: FConnection) {
        this.connection = connection;
        this.keySpace = connection.keySpace;
        this.directory = connection.directories.getDirectory(['atomic', name]);
    }

    protected _findById(key: FTuple[]) {
        return new FAtomicInteger(FKeyEncoding.encodeKey(key), this.directory);
    }
}