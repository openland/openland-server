import { keySelector } from 'foundationdb';
import { FConnection } from 'foundation-orm/FConnection';
import { FContext } from 'foundation-orm/FContext';
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

const log = createLogger('tx', false);

export abstract class FBaseTransaction implements FContext {
    private static nextId = 1;

    readonly id = FBaseTransaction.nextId++;
    abstract isReadOnly: boolean;
    abstract isCompleted: boolean;
    tx: Transaction<NativeValue, any> | null = null;

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
        return await tracer.trace(parent, 'get', async (ctx) => {
            this.log.debug(ctx, 'get');
            return await this.concurrencyPool!.run(() => (this.isReadOnly ? this.tx!.snapshot() : this.tx!).get(key));
        });
    }

    async range(parent: Context, connection: FConnection, key: Buffer, options?: RangeOptions): Promise<{ item: any, key: Buffer }[]> {
        this.prepare(parent, connection);
        return await tracer.trace(parent, 'range', async (ctx) => {
            this.log.debug(ctx, 'get-range');
            let res = await this.concurrencyPool!.run(() => (this.isReadOnly ? this.tx!.snapshot() : this.tx!).getRangeAll(key, undefined, options));
            return res.map((v) => ({ item: v[1] as any, key: v[0] }));
        });
    }
    async rangeAll(parent: Context, connection: FConnection, key: Buffer, options?: RangeOptions): Promise<any[]> {
        this.prepare(parent, connection);
        return await tracer.trace(parent, 'rangeAll', async (ctx) => {
            this.log.debug(ctx, 'get-range-all');
            let res = await this.concurrencyPool!.run(() => (this.isReadOnly ? this.tx!.snapshot() : this.tx!).getRangeAll(key, undefined, options));
            return res.map((v) => v[1] as any);
        });
    }
    async rangeAfter(parent: Context, connection: FConnection, prefix: (string | number)[], afterKey: (string | number)[], options?: RangeOptions): Promise<{ item: any, key: Buffer }[]> {
        this.prepare(parent, connection);
        return await tracer.trace(parent, 'rangeAfter', async (ctx) => {
            this.log.debug(ctx, 'get-range-after');
            let reversed = (options && options.reverse) ? true : false;
            let start = reversed ? FKeyEncoding.firstKeyInSubspace(prefix) : keySelector.firstGreaterThan(FKeyEncoding.lastKeyInSubspace(afterKey));
            let end = reversed ? FKeyEncoding.encodeKey(afterKey) : FKeyEncoding.lastKeyInSubspace(prefix);
            let res = await this.concurrencyPool!.run(() => (this.isReadOnly ? this.tx!.snapshot() : this.tx!).getRangeAll(start, end, options));
            return res.map((v) => ({ item: v[1] as any, key: v[0] }));
        });
    }

    protected abstract createTransaction(connection: FConnection): Transaction;

    abstract markDirty(parent: Context, entity: FEntity, callback: (connection: FConnection) => Promise<void>): void;
    abstract set(context: Context, connection: FConnection, key: Buffer, value: any): void;
    abstract delete(context: Context, connection: FConnection, key: Buffer): void;
    abstract afterTransaction(callback: () => void): void;

    protected prepare(ctx: Context, connection: FConnection) {
        if (this.connection && this.connection !== connection) {
            throw Error('Unable to use two different connections in the same transaction');
        }
        if (this.connection) {
            return;
        }

        log.debug(ctx, 'started');
        this.connection = connection;
        this.concurrencyPool = getConcurrencyPool(ctx);
        this.tx = this.createTransaction(connection);
    }
}