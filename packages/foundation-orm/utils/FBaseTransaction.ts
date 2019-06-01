import { encoders } from 'foundationdb';
import { FConnection } from 'foundation-orm/FConnection';
import { FTransaction } from 'foundation-orm/FTransaction';
import { FEntity } from 'foundation-orm/FEntity';
import Transaction, { RangeOptions } from 'foundationdb/dist/lib/transaction';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { createLogger } from 'openland-log/createLogger';
import { tracer } from './tracer';
import { SLog } from 'openland-log/SLog';
import { FKeyEncoding } from './FKeyEncoding';
import { Context } from 'openland-utils/Context';
import { ConcurrencyPool, getConcurrencyPool } from 'openland-utils/ConcurrencyPool';
import { ReadWriteLock } from './readWriteLock';
import { decodeAtomic, encodeAtomic } from './atomicEncode';
import { TransactionWrapper } from 'foundation-orm/tx/TransactionWrapper';

const log = createLogger('tx', false);

export abstract class FBaseTransaction implements FTransaction {
    private static nextId = 1;

    readonly id = FBaseTransaction.nextId++;
    abstract isReadOnly: boolean;
    abstract isCompleted: boolean;
    tx: TransactionWrapper | null = null;

    protected readonly log: SLog = log;
    protected connection: FConnection | null = null;
    protected concurrencyPool: ConcurrencyPool | null = null;

    protected cache = new Map<string, any>();
    private readWriteLocks = new Map<string, ReadWriteLock>();

    readWriteLock(key: string): ReadWriteLock {
        if (!this.readWriteLocks.has(key)) {
            this.readWriteLocks.set(key, new ReadWriteLock());
        }
        return this.readWriteLocks.get(key)!;
    }

    findInCache(key: string): any | null | undefined {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        } else {
            return undefined;
        }
    }

    putInCache(key: string, value: any | null) {
        this.cache.set(key, value);
    }

    async get(parent: Context, connection: FConnection, key: Buffer): Promise<any | null> {
        this.prepare(parent, connection);
        let r = await this.tx!.get(key);
        if (r) {
            return encoders.json.unpack(r);
        } else {
            return null;
        }
    }

    async range(parent: Context, connection: FConnection, key: Buffer, options?: RangeOptions): Promise<{ item: any, key: Buffer }[]> {
        this.prepare(parent, connection);
        return (await this.tx!.range(key, {
            limit: options && options.limit ? options.limit : undefined,
            reverse: options && options.reverse ? options.reverse : undefined,
        })).map((v) => ({ item: encoders.json.unpack(v.value), key: v.key }));
    }

    async rangeAll(parent: Context, connection: FConnection, key: Buffer, options?: RangeOptions): Promise<any[]> {
        this.prepare(parent, connection);
        return (await this.tx!.range(key, {
            limit: options && options.limit ? options.limit : undefined,
            reverse: options && options.reverse ? options.reverse : undefined,
        })).map((v) => encoders.json.unpack(v.value));
    }
    async rangeAfter(parent: Context, connection: FConnection, prefix: (string | number)[], afterKey: (string | number)[], options?: RangeOptions): Promise<{ item: any, key: Buffer }[]> {
        this.prepare(parent, connection);
        return (await this.tx!.range(FKeyEncoding.encodeKey(prefix), {
            after: FKeyEncoding.encodeKey(afterKey),
            limit: options && options.limit ? options.limit : undefined,
            reverse: options && options.reverse ? options.reverse : undefined,
        })).map((v) => ({ item: encoders.json.unpack(v.value), key: v.key }));
    }

    set(parent: Context, connection: FConnection, key: Buffer, value: any) {
        if (this.isReadOnly) {
            throw Error('Trying to write to read-only transaction');
        }
        this.prepare(parent, connection);
        this.tx!.set(key, encoders.json.pack(value) as Buffer);
    }

    delete(parent: Context, connection: FConnection, key: Buffer) {
        if (this.isReadOnly) {
            throw Error('Trying to write to read-only transaction');
        }
        this.prepare(parent, connection);
        this.tx!.delete(key);
    }

    atomicSet(context: Context, connection: FConnection, key: Buffer, value: number) {
        if (this.isReadOnly) {
            throw Error('Trying to write to read-only transaction');
        }
        this.prepare(context, connection);
        this.tx!.set(key, encodeAtomic(value));
    }

    atomicAdd(context: Context, connection: FConnection, key: Buffer, value: number) {
        if (this.isReadOnly) {
            throw Error('Trying to write to read-only transaction');
        }
        this.prepare(context, connection);
        this.tx!.atomicAdd(key, encodeAtomic(value));
    }

    //
    // Atomic
    //

    async atomicGet(context: Context, connection: FConnection, key: Buffer) {
        this.prepare(context, connection);
        return await tracer.trace(context, 'atomicGet', async (ctx) => {
            let r = await connection.fdb.get(key);
            if (r) {
                return decodeAtomic(r);
            } else {
                return null;
            }
        });
    }

    //
    // Connection
    //

    protected prepare(ctx: Context, connection: FConnection) {
        if (this.connection && this.connection !== connection) {
            throw Error('Unable to use two different connections in the same transaction');
        }
        if (this.connection) {
            return;
        }

        // log.debug(ctx, 'started');
        this.connection = connection;
        this.concurrencyPool = getConcurrencyPool(ctx);
        this.tx = new TransactionWrapper(this.createTransaction(connection) as Transaction<Buffer, Buffer>);
    }

    protected abstract createTransaction(connection: FConnection): Transaction<NativeValue, Buffer>;

    //
    // Lifecycle
    //

    abstract markDirty(parent: Context, entity: FEntity, callback: (ctx: Context) => Promise<void>): void;
    abstract afterTransaction(callback: () => void): void;
}