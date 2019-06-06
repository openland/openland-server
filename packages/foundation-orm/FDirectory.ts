import { FConnection } from './FConnection';
import { Context } from '@openland/context';
import { DirectoryAllocator } from './layers/directory/DirectoryAllocator';
import { FSubspace } from './FSubspace';
import { FRangeOptions } from './FRangeOptions';
import { FTransformer } from './encoding/FTransformer';
import { FTransformedSubspace } from './subspace/FTransformedSubspace';
import { FEncoders } from './encoding/FEncoders';
import { FSubspaceImpl } from './subspace/FSubspaceImpl';

export class FDirectory implements FSubspace {
    readonly connection: FConnection;
    private readonly allocatorProcess: Promise<void>;
    private keyspace!: FSubspace;
    private allocatedKey!: Buffer;
    private isAllocated = false;

    constructor(connection: FConnection, allocator: DirectoryAllocator, key: (string | number | boolean)[]) {
        this.connection = connection;
        this.allocatorProcess = (async () => {
            let v = await allocator.allocateDirectory(key);
            this.allocatedKey = v;
            this.isAllocated = true;
            this.keyspace = connection.keySpace.subspace(v);
        })();
    }

    ready = async () => {
        await this.allocatorProcess;
    }

    //
    // Proxy methods
    //

    withKeyEncoding<K2>(keyTf: FTransformer<Buffer, K2>): FSubspace<K2, Buffer> {
        return new FTransformedSubspace<K2, Buffer, Buffer, Buffer>(this, keyTf, FEncoders.id<Buffer>());
    }
    withValueEncoding<V2>(valueTf: FTransformer<Buffer, V2>): FSubspace<Buffer, V2> {
        return new FTransformedSubspace<Buffer, V2, Buffer, Buffer>(this, FEncoders.id<Buffer>(), valueTf);
    }
    subspace(key: Buffer): FSubspace<Buffer, Buffer> {
        if (!this.isAllocated) {
            throw Error('Directory is not ready');
        }
        return new FSubspaceImpl(this.connection, Buffer.concat([this.allocatedKey, key]));
    }

    get(ctx: Context, key: Buffer): Promise<Buffer | null> {
        if (!this.isAllocated) {
            throw Error('Directory is not ready');
        }
        return this.keyspace.get(ctx, key);
    }

    range(ctx: Context, key: Buffer, opts?: FRangeOptions<Buffer>): Promise<{ key: Buffer, value: Buffer }[]> {
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

    setWithVerstionstamp(ctx: Context, key: Buffer, value: Buffer) {
        if (!this.isAllocated) {
            throw Error('Directory is not ready');
        }
        return this.keyspace.setWithVerstionstamp(ctx, key, value);
    }

    setWithVerstionstampUnique(ctx: Context, key: Buffer, value: Buffer) {
        if (!this.isAllocated) {
            throw Error('Directory is not ready');
        }
        return this.keyspace.setWithVerstionstampUnique(ctx, key, value);
    }

    delete(ctx: Context, key: Buffer) {
        if (!this.isAllocated) {
            throw Error('Directory is not ready');
        }
        return this.keyspace.delete(ctx, key);
    }

    add(ctx: Context, key: Buffer, value: Buffer) {
        if (!this.isAllocated) {
            throw Error('Directory is not ready');
        }
        return this.keyspace.add(ctx, key, value);
    }

    or(ctx: Context, key: Buffer, value: Buffer) {
        if (!this.isAllocated) {
            throw Error('Directory is not ready');
        }
        return this.keyspace.or(ctx, key, value);
    }

    xor(ctx: Context, key: Buffer, value: Buffer) {
        if (!this.isAllocated) {
            throw Error('Directory is not ready');
        }
        return this.keyspace.xor(ctx, key, value);
    }
}