import { FConnection } from 'foundation-orm/FConnection';
import { DirectoryAllocator } from './directory/DirectoryAllocator';
import { FDirectory } from 'foundation-orm/FDirectory';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { createLogger } from 'openland-log/createLogger';
import { Context } from '@openland/context';

const log = createLogger('directory-layer');

export class FDirectoryLayer {
    private readonly connection: FConnection;
    private readonly allocator: DirectoryAllocator;
    private readonly directories = new Map<string, FDirectory>();
    constructor(connection: FConnection) {
        this.connection = connection;
        this.allocator = new DirectoryAllocator(this.connection);
    }

    async findAllDirectories() {
        return this.allocator.findAllDirectories();
    }

    getDirectory(key: (string | number | boolean)[]) {
        let k = FKeyEncoding.encodeKeyToString(key);
        if (!this.directories.has(k)) {
            this.directories.set(k, new FDirectory(this.connection, this.allocator, key));
        }
        return this.directories.get(k)!;
    }

    async ready(ctx: Context) {
        log.log(ctx, 'Waiting for allocations');
        for (let v of this.directories.values()) {
            log.log(ctx, 'Waiting for ' + v.key.join('.'));
            await v.ready();
        }
        log.log(ctx, 'Directory allocation completed');
    }
}