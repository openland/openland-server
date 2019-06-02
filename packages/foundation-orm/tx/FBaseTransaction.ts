import { encoders } from 'foundationdb';
import { FConnection } from 'foundation-orm/FConnection';
import { FTransaction } from 'foundation-orm/FTransaction';
import Transaction, { RangeOptions } from 'foundationdb/dist/lib/transaction';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { createLogger } from 'openland-log/createLogger';
import { SLog } from 'openland-log/SLog';
import { Context } from '@openland/context';
import { ReadWriteLock } from '../utils/readWriteLock';
import { FRawTransaction } from './FRawTransaction';

const log = createLogger('tx', false);

export abstract class FBaseTransaction implements FTransaction {
    private static nextId = 1;

    readonly id = FBaseTransaction.nextId++;
    abstract isReadOnly: boolean;
    abstract isCompleted: boolean;
    protected readonly log: SLog = log;
    protected connection: FConnection | null = null;
    protected tx!: FRawTransaction;
    protected rawTx!: Transaction<Buffer, Buffer>;

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

    async range(parent: Context, connection: FConnection, key: Buffer, options?: RangeOptions): Promise<{ item: any, key: Buffer }[]> {
        this.prepare(connection);
        return (await this.tx!.range(key, {
            limit: options && options.limit ? options.limit : undefined,
            reverse: options && options.reverse ? options.reverse : undefined,
        })).map((v) => ({ item: encoders.json.unpack(v.value), key: v.key }));
    }

    async rangeAll(parent: Context, connection: FConnection, key: Buffer, options?: RangeOptions): Promise<any[]> {
        this.prepare(connection);
        return (await this.tx!.range(key, {
            limit: options && options.limit ? options.limit : undefined,
            reverse: options && options.reverse ? options.reverse : undefined,
        })).map((v) => encoders.json.unpack(v.value));
    }

    set(parent: Context, connection: FConnection, key: Buffer, value: any) {
        if (this.isReadOnly) {
            throw Error('Trying to write to read-only transaction');
        }
        this.prepare(connection);
        this.tx!.set(key, encoders.json.pack(value) as Buffer);
    }

    //
    // Connection
    //

    protected prepare(connection: FConnection) {
        if (this.connection && this.connection !== connection) {
            throw Error('Unable to use two different connections in the same transaction');
        }
        if (this.connection) {
            return;
        }

        // log.debug(ctx, 'started');
        this.connection = connection;
        this.rawTx = this.createTransaction(connection) as Transaction<Buffer, Buffer>;
        this.tx = new FRawTransaction(this.rawTx);
    }

    protected abstract createTransaction(connection: FConnection): Transaction<NativeValue, Buffer>;

    rawTransaction(connection: FConnection): Transaction<Buffer, Buffer> {
        this.prepare(connection);
        return this.rawTx;
    }

    //
    // Lifecycle
    //

    abstract beforeCommit(fn: ((ctx: Context) => Promise<void>) | (() => void)): void;
    abstract afterCommit(fn: (ctx: Context) => void): void;
}