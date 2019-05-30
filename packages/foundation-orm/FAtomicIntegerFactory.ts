import { FNamespace } from './FNamespace';
import { FConnection } from './FConnection';
import { FDirectory } from './FDirectory';
import { Context } from 'openland-utils/Context';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { FAtomicInteger } from './FAtomicInteger';

export class FAtomicIntegerFactory {

    readonly connection: FConnection;
    readonly namespace: FNamespace;
    readonly directory: FDirectory;

    constructor(connection: FConnection, namespace: FNamespace) {
        this.connection = connection;
        this.namespace = namespace;
        this.directory = connection.getDirectory(namespace.namespace);
    }

    protected async _findById(ctx: Context, key: (string | number)[]) {
        if (!this.directory.isAllocated) {
            await this.directory.awaitAllocation();
        }
        let prefixKey = this.directory.getAllocatedKey;
        let converteKey = Buffer.concat([prefixKey, FKeyEncoding.encodeKey(key)]);

        return new FAtomicInteger(converteKey, this.connection);
    }
}