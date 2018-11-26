import { FConnection } from './FConnection';
import { DirectoryAllocator } from './utils/DirectoryAllocator';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { Context } from 'openland-utils/Context';
import { resolveContext } from './utils/contexts';

export class FDirectory {
    readonly connection: FConnection;
    private readonly allocatorProcess: Promise<Buffer>;
    private allocatedKey?: Buffer;

    constructor(connection: FConnection, allocator: DirectoryAllocator, key: (string | number | boolean)[]) {
        this.connection = connection;
        this.allocatorProcess = (async () => {
            let v = await allocator.allocateDirectory(key);
            this.onAllocated(v);
            return v;
        })();
    }

    get isAllocated() {
        return !!this.allocatedKey;
    }

    awaitAllocation = async () => {
        await this.allocatorProcess;
    }

    get = async (ctx: Context, key: (string | number)[]) => {
        if (!this.isAllocated) {
            await this.allocatorProcess;
        }
        return resolveContext(ctx).get(ctx, this.connection, Buffer.concat([this.allocatedKey!, FKeyEncoding.encodeKey(key)]));
    }

    range = async (ctx: Context, key: (string | number)[]) => {
        if (!this.isAllocated) {
            await this.allocatorProcess;
        }
        return resolveContext(ctx).rangeAll(ctx, this.connection, Buffer.concat([this.allocatedKey!, FKeyEncoding.encodeKey(key)]));
    }

    range2 = async (ctx: Context, key: (string | number)[]) => {
        if (!this.isAllocated) {
            await this.allocatorProcess;
        }
        return resolveContext(ctx).range(ctx, this.connection, Buffer.concat([this.allocatedKey!, FKeyEncoding.encodeKey(key)]));
    }

    set = (ctx: Context, key: (string | number)[], value: any) => {
        resolveContext(ctx).set(ctx, this.connection, Buffer.concat([this.allocatedKey!, FKeyEncoding.encodeKey(key)]), value);
    }

    private onAllocated(key: Buffer) {
        this.allocatedKey = key;
    }
}