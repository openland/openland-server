import { FNamespace } from './FNamespace';
import { FConnection } from './FConnection';
import { FEntity, FEntityOptions } from './FEntity';
import { FWatch } from './FWatch';
import { FEntityIndex } from './FEntityIndex';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { FStream } from './FStream';
import { createLogger } from 'openland-log/createLogger';
import { FLiveStream } from './FLiveStream';
import { FLiveStreamItem } from './FLiveStreamItem';
import { FDirectory } from './FDirectory';
import { Context } from 'openland-utils/Context';
import { FCacheContextContext, FTransactionContext } from './utils/contexts';
import { tracer } from './utils/tracer';

const log = createLogger('entity-factory');

export abstract class FEntityFactory<T extends FEntity> {
    readonly namespace: FNamespace;
    readonly directory: FDirectory;
    readonly connection: FConnection;
    readonly options: FEntityOptions;
    readonly indexes: FEntityIndex[];
    readonly name: string;
    private watcher: FWatch;
    // private tracer: STracer;

    constructor(connection: FConnection, namespace: FNamespace, options: FEntityOptions, indexes: FEntityIndex[], name: string) {
        // this.tracer = createTracer(name);
        this.namespace = namespace;
        this.directory = connection.getDirectory(namespace.namespace);
        this.connection = connection;
        this.options = options;
        this.indexes = indexes;
        this.name = name;
        this.watcher = new FWatch(connection);
    }

    async findByRawId(ctx: Context, key: (string | number)[]) {
        return this.readOp(ctx, async () => {
            let res = await this.namespace.get(ctx, this.connection, key);
            if (res) {
                return this.doCreateEntity(ctx, res, false);
            }
            return null;
        });
    }

    async findAll(ctx: Context) {
        return this.readOp(ctx, async () => (await this.directory.range(ctx, [])).map((v) => this.doCreateEntity(ctx, v, false)));
    }

    async findAllKeys(ctx: Context, limit?: number) {
        return this.readOp(ctx, async () => {
            let res = await this.namespace.range(ctx, this.connection, [], { limit });
            res = res.filter((v) => !FKeyEncoding.decodeKey(v.key).find((k) => k === '__indexes'));
            return res.map((v) => v.key);
        });
    }

    async findAllKeysAfter(ctx: Context, after: any[], limit?: number) {
        return this.readOp(ctx, async () => {
            let res = await this.namespace.rangeAfter(ctx, this.connection, [], after, { limit });
            res = res.filter((v) => !FKeyEncoding.decodeKey(v.key).find((k) => k === '__indexes'));
            return res.map((v) => v.key);
        });
    }

    async findAllWithIds(ctx: Context) {
        return this.readOp(ctx, async () => {
            let res = await this.namespace.range(ctx, this.connection, []);
            return res.map((v) => ({ item: this.doCreateEntity(ctx, v.item, false), key: v.key }));
        });
    }

    abstract extractId(rawId: any[]): any;

    protected abstract _createEntity(ctx: Context, value: any, isNew: boolean): T;

    protected async  _findById(parent: Context, key: (string | number)[]) {
        return this.readOp(parent, async () => {
            return await this._findByIdInternal(parent, key);
        });
    }

    protected async _findFromIndex(parent: Context, key: (string | number)[]) {
        return this.readOp(parent, async () => {
            return await tracer.trace(parent, 'FindById', async (ctx) => {
                let res = await this.namespace.get(ctx, this.connection, key);
                if (res) {
                    return this.doCreateEntity(ctx, res, false);
                }
                return null;
            });
        });
    }

    protected async _findRangeAllAfter(ctx: Context, key: (string | number)[], after: any, reverse?: boolean) {
        return this.readOp(ctx, async () => {
            let res = await this.namespace.rangeAfter(ctx, this.connection, key, [...this.namespace.namespace, ...key, after], { reverse });
            return res.map((v) => this.doCreateEntity(ctx, v.item, false));
        });
    }

    protected async _findRange(ctx: Context, key: (string | number)[], limit: number, reverse?: boolean) {
        return this.readOp(ctx, async () => {
            let res = await this.namespace.range(ctx, this.connection, key, { limit, reverse });
            return res.map((v) => this.doCreateEntity(ctx, v.item, false));
        });
    }

    protected async _findRangeWithCursor(ctx: Context, key: (string | number)[], limit: number, after?: string, reverse?: boolean) {
        return this.readOp(ctx, async () => {
            let res: { item: any, key: Buffer }[];
            if (after) {
                res = await this.namespace.rangeAfter(ctx, this.connection, key, FKeyEncoding.decodeFromString(after) as any, { limit: limit + 1, reverse });
            } else {
                res = await this.namespace.range(ctx, this.connection, key, { limit: limit + 1, reverse });
            }
            let d: T[] = [];
            for (let i = 0; i < Math.min(limit, res.length); i++) {
                d.push(this._createEntity(ctx, res[i].item, false));
            }
            let cursor = res.length ? FKeyEncoding.encodeKeyToString(FKeyEncoding.decodeKey((res[Math.min(res.length, limit) - 1]).key) as any) : after;
            let haveMore = res.length > limit;
            return { items: d, cursor, haveMore };
        });
    }

    protected async _findRangeAfter(ctx: Context, subspace: (string | number)[], after: any, limit?: number, reverse?: boolean) {
        return this.readOp(ctx, async () => {
            let res = await this.namespace.rangeAfter(ctx, this.connection, subspace, [...this.namespace.namespace, ...subspace, after], { limit, reverse });
            return res.map((v) => this.doCreateEntity(ctx, v.item, false));
        });
    }

    protected _createStream(ctx: Context, subspace: (string | number)[], limit: number, after?: string): FStream<T> {
        return new FStream(this, subspace, limit, (s) => this.doCreateEntity(ctx, s, false), after);
    }
    protected _createLiveStream(ctx: Context, subspace: (string | number)[], limit: number, after?: string): AsyncIterable<FLiveStreamItem<T>> {
        return new FLiveStream<T>(new FStream(this, subspace, limit, (s) => this.doCreateEntity(ctx, s, false), after)).generator();
    }

    protected async _findAll(ctx: Context, key: (string | number)[]) {
        return this.readOp(ctx, async () => {
            let res = await this.namespace.range(ctx, this.connection, key);
            return res.map((v) => this.doCreateEntity(ctx, v.item, false));
        });
    }

    protected async _create(parent: Context, key: (string | number)[], value: any) {
        return await tracer.trace(parent, 'Create:' + this.name, async (ctx) => {
            return this.writeOp(ctx, async () => {
                let cache = FTransactionContext.get(parent);
                if (!cache) {
                    throw Error('Tried to create object outside of transaction');
                }
                if (await this._findByIdInternal(ctx, key)) {
                    throw Error('Object with id ' + [...this.namespace.namespace, ...key].join('.') + ' already exists');
                }
                let res = this.doCreateEntity(ctx, value, true);
                await res.flush(ctx, { noWriteLock: true, unsafe: false });
                return res;
            });
        });
    }

    protected async _create_UNSAFE(parent: Context, key: (string | number)[], value: any) {
        return await tracer.trace(parent, 'CreateUNSAFE:' + this.name, async (ctx) => {
            let cache = FTransactionContext.get(parent);
            if (!cache) {
                throw Error('Tried to create object outside of transaction');
            }
            let res = this.doCreateEntity(ctx, value, true);
            await res.flush(ctx, { noWriteLock: true, unsafe: true });
            return res;
        });
    }

    protected _watch(ctx: Context, key: (string | number)[], cb: () => void) {
        let fullKey = [...this.namespace.namespace, ...key];

        return this.watcher.watch(ctx, fullKey, cb);
    }

    private doCreateEntity(ctx: Context, value: any, isNew: boolean): T {
        try {
            this.options.validator(value);
            let res = this._createEntity(ctx, value, isNew);
            let cache = FTransactionContext.get(ctx) || FCacheContextContext.get(ctx);
            if (cache) {
                let cacheKey = FKeyEncoding.encodeKeyToString([...this.namespace.namespace, ...res.rawId]);
                let ex = cache.findInCache(cacheKey);
                if (ex) {
                    if (isNew) {
                        throw Error('Internal inconsistency during creation');
                    }
                    return ex;
                } else {
                    cache.putInCache(cacheKey, res);
                    return res;
                }
            } else {
                return res;
            }
        } catch (e) {
            log.warn(ctx, 'Unable to create entity from ', JSON.stringify(value), e);
            throw e;
        }
    }

    private async  _findByIdInternal(parent: Context, key: (string | number)[]): Promise<T | null> {

        // Cached
        let cache = FTransactionContext.get(parent) || FCacheContextContext.get(parent);
        if (cache) {
            let cacheKey = FKeyEncoding.encodeKeyToString([...this.namespace.namespace, ...key]);

            let cached = cache!.findInCache(cacheKey);
            if (cached) {
                return cached;
            } else {
                let res = await tracer.trace(parent, 'FindById:' + this.name, async (ctx) => {
                    let r = await this.namespace.get(ctx, this.connection, key);
                    if (r) {
                        return this.doCreateEntity(ctx, r, false);
                    } else {
                        return null;
                    }
                });
                // cache!.putInCache(cacheKey, res);
                return res;
            }
        }

        // Uncached (Obsolete: Might never happen)
        return await tracer.trace(parent, 'FindById:' + this.name, async (ctx) => {
            let res = await this.namespace.get(ctx, this.connection, key);
            if (res) {
                return this.doCreateEntity(ctx, res, false);
            }
            return null;
        });
    }

    private writeOp<T2>(ctx: Context, fn: () => Promise<T2>): Promise<T2> {
        return this.getLock(ctx)!.runWriteOperation(ctx, fn);
        // return this.readOp(ctx, fn);
    }

    private readOp<T2>(ctx: Context, fn: () => Promise<T2>): Promise<T2> {
        let lock = this.getLock(ctx);
        if (lock) {
            return lock.runReadOperation(ctx, fn);
        } else {
            return fn();
        }
    }

    private getLock(ctx: Context) {
        let cache = FTransactionContext.get(ctx) || FCacheContextContext.get(ctx);
        if (!cache) {
            // throw Error('No transaction or cache in the context!');
            return null;
        }
        return cache.readWriteLock(this.name);
    }
}