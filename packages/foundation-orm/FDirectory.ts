import { Context } from '@openland/context';
import { DirectoryAllocator } from './layers/directory/DirectoryAllocator';
import { Subspace, Transformer, encoders, RangeOptions, Database } from '@openland/foundationdb';
import { TransformedSubspace } from '@openland/foundationdb/lib/impl/TransformedSubspace';
import { Watch } from '@openland/foundationdb/lib/Watch';

export class FDirectory implements Subspace {
    readonly connection: Database;
    readonly path: string[];
    private readonly allocatorProcess: Promise<void>;
    private keyspace!: Subspace;
    private allocatedKey!: Buffer;
    private isAllocated = false;

    constructor(connection: Database, allocator: DirectoryAllocator, path: string[]) {
        this.connection = connection;
        this.path = path;
        this.allocatorProcess = (async () => {
            let v = await allocator.allocateDirectory(path);
            this.allocatedKey = v;
            this.isAllocated = true;
            this.keyspace = connection.allKeys.subspace(v);
        })();
    }

    ready = async () => {
        await this.allocatorProcess;
    }

    get prefix() {
        if (!this.isAllocated) {
            throw Error('Directory is not ready');
        }
        return this.allocatedKey;
    }

    //
    // Proxy methods
    //

    withKeyEncoding<K2>(keyTf: Transformer<Buffer, K2>): Subspace<K2, Buffer> {
        return new TransformedSubspace<K2, Buffer, Buffer, Buffer>(this, keyTf, encoders.id<Buffer>());
    }
    withValueEncoding<V2>(valueTf: Transformer<Buffer, V2>): Subspace<Buffer, V2> {
        return new TransformedSubspace<Buffer, V2, Buffer, Buffer>(this, encoders.id<Buffer>(), valueTf);
    }
    subspace(key: Buffer): Subspace<Buffer, Buffer> {
        if (!this.isAllocated) {
            throw Error('Directory is not ready');
        }
        return this.keyspace.subspace(key);
    }

    get(ctx: Context, key: Buffer): Promise<Buffer | null> {
        if (!this.isAllocated) {
            throw Error('Directory is not ready');
        }
        return this.keyspace.get(ctx, key);
    }

    range(ctx: Context, key: Buffer, opts?: RangeOptions<Buffer>): Promise<{ key: Buffer, value: Buffer }[]> {
        if (!this.isAllocated) {
            throw Error('Directory is not ready');
        }
        return this.keyspace.range(ctx, key, opts);
    }

    set(ctx: Context, key: Buffer, value: Buffer) {
        if (!this.isAllocated) {
            throw Error('Directory is not ready');
        }
        return this.keyspace.set(ctx, key, value);
    }

    clear(ctx: Context, key: Buffer) {
        if (!this.isAllocated) {
            throw Error('Directory is not ready');
        }
        return this.keyspace.clear(ctx, key);
    }

    add(ctx: Context, key: Buffer, value: Buffer) {
        if (!this.isAllocated) {
            throw Error('Directory is not ready');
        }
        return this.keyspace.add(ctx, key, value);
    }

    bitOr(ctx: Context, key: Buffer, value: Buffer) {
        if (!this.isAllocated) {
            throw Error('Directory is not ready');
        }
        return this.keyspace.bitOr(ctx, key, value);
    }

    bitXor(ctx: Context, key: Buffer, value: Buffer) {
        if (!this.isAllocated) {
            throw Error('Directory is not ready');
        }
        return this.keyspace.bitXor(ctx, key, value);
    }

    bitAnd(ctx: Context, key: Buffer, value: Buffer) {
        if (!this.isAllocated) {
            throw Error('Directory is not ready');
        }
        return this.keyspace.bitAnd(ctx, key, value);
    }

    watch(ctx: Context, key: Buffer): Watch {
        if (!this.isAllocated) {
            throw Error('Directory is not ready');
        }
        return this.keyspace.watch(ctx, key);
    }
}