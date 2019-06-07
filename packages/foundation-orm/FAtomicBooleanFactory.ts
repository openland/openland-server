import { FNamespace } from './FNamespace';
import { FConnection } from './FConnection';
import { FDirectory } from './FDirectory';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { FSubspace } from './FSubspace';
import { FTuple } from './encoding/FTuple';
import { FAtomicBoolean } from './FAtomicBoolean';

export class FAtomicBooleanFactory {

    readonly connection: FConnection;
    readonly directory: FDirectory;
    readonly keySpace: FSubspace;

    constructor(connection: FConnection, namespace: FNamespace) {
        this.connection = connection;
        this.keySpace = connection.keySpace;
        this.directory = connection.directories.getDirectory(namespace.namespace);
    }

    protected _findById(key: FTuple[]) {
        return new FAtomicBoolean(FKeyEncoding.encodeKey(key), this.directory);
    }
}