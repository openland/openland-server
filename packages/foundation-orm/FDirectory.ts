import { FConnection } from './FConnection';
import { DirectoryAllocator } from './utils/DirectoryAllocator';

export class FDirectory {
    readonly connection: FConnection;
    readonly allocator: DirectoryAllocator;

    constructor(connection: FConnection, allocator: DirectoryAllocator, key: (string | number | boolean)[]) {
        this.connection = connection;
        this.allocator = allocator;
    }
}