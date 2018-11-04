import { FConnection } from './FConnection';
import { DirectoryAllocator } from './utils/DirectoryAllocator';
import { FKeyEncoding } from './utils/FKeyEncoding';

export class FDirectory {
    readonly connection: FConnection;
    private readonly allocatorProcess: Promise<Buffer>;
    private allocatedKey?: Buffer;

    constructor(connection: FConnection, allocator: DirectoryAllocator, key: (string | number | boolean)[]) {
        this.connection = connection;
        this.allocatorProcess = allocator.allocateDirectory(key).then((v) => {
            this.onAllocated(v);
            return v;
        });
    }

    get isAllocated() {
        return !!this.allocatedKey;
    }

    awaitAllocation = async () => {
        await this.allocatorProcess;
    }

    set = (key: (string | number)[], value: any) => {
        this.connection.currentContext.set(this.connection, Buffer.concat([this.allocatedKey!, FKeyEncoding.encodeKey(key)]), value);
    }

    private onAllocated(key: Buffer) {
        this.allocatedKey = key;
    }
}