import { FConnection } from './FConnection';
import { DirectoryAllocator } from './utils/DirectoryAllocator';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { Context } from 'openland-utils/Context';
import { getTransaction } from './getTransaction';

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

    get getAllocatedKey() {
        if (!this.allocatedKey) {
            throw Error('Not yet allocated');
        }
        return this.allocatedKey!!;
    }

    awaitAllocation = async () => {
        await this.allocatorProcess;
    }

    get = async (ctx: Context, key: (string | number)[]) => {
        if (!this.isAllocated) {
            await this.allocatorProcess;
        }
        return getTransaction(ctx).get(ctx, this.connection, Buffer.concat([this.allocatedKey!, FKeyEncoding.encodeKey(key)]));
    }

    range = async (ctx: Context, key: (string | number)[]) => {
        if (!this.isAllocated) {
            await this.allocatorProcess;
        }
        return getTransaction(ctx).rangeAll(ctx, this.connection, Buffer.concat([this.allocatedKey!, FKeyEncoding.encodeKey(key)]));
    }

    range2 = async (ctx: Context, key: (string | number)[]) => {
        if (!this.isAllocated) {
            await this.allocatorProcess;
        }
        let res = await getTransaction(ctx).range(ctx, this.connection, Buffer.concat([this.allocatedKey!, FKeyEncoding.encodeKey(key)]));
        return res.map((v) => ({ key: v.key.slice(this.allocatedKey!.length), item: v.item }));
    }

    set = (ctx: Context, key: (string | number)[], value: any) => {
        getTransaction(ctx).set(ctx, this.connection, Buffer.concat([this.allocatedKey!, FKeyEncoding.encodeKey(key)]), value);
    }

    private onAllocated(key: Buffer) {
        this.allocatedKey = key;
    }
}