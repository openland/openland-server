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
        let res = await this.namespace.get(ctx, this.connection, key);
        if (res) {
            return this.doCreateEntity(ctx, res, false);
        }
        return null;
    }

    async findAll(ctx: Context) {
        return (await this.directory.range(ctx, [])).map((v) => this.doCreateEntity(ctx, v, false));
    }

    async findAllKeys(ctx: Context, limit?: number) {
        let res = await this.namespace.range(ctx, this.connection, [], { limit });
        res = res.filter((v) => !FKeyEncoding.decodeKey(v.key).find((k) => k === '__indexes'));
        return res.map((v) => v.key);
    }

    async findAllKeysAfter(ctx: Context, after: any[], limit?: number) {
        let res = await this.namespace.rangeAfter(ctx, this.connection, [], after, { limit });
        res = res.filter((v) => !FKeyEncoding.decodeKey(v.key).find((k) => k === '__indexes'));
        return res.map((v) => v.key);
    }

    async findAllWithIds(ctx: Context) {
        let res = await this.namespace.range(ctx, this.connection, []);
        return res.map((v) => ({ item: this.doCreateEntity(ctx, v.item, false), key: v.key }));
    }

    abstract extractId(rawId: any[]): any;

    protected abstract _createEntity(ctx: Context, value: any, isNew: boolean): T;

    protected async  _findById(parent: Context, key: (string | number)[]) {
        return this._findByIdInternal(parent, key, true);
    }

    protected async _findFromIndex(parent: Context, key: (string | number)[]) {
        // let res = await this.directory.get(key);
        return await tracer.trace(parent, 'FindById', async (ctx) => {
            let res = await this.namespace.get(ctx, this.connection, key);
            if (res) {
                return this.doCreateEntity(ctx, res, false);
            }
            return null;
        });
    }

    protected async _findRangeAllAfter(ctx: Context, key: (string | number)[], after: any, reverse?: boolean) {
        let res = await this.namespace.rangeAfter(ctx, this.connection, key, [...this.namespace.namespace, ...key, after], { reverse });
        return res.map((v) => this.doCreateEntity(ctx, v.item, false));
    }

    protected async _findRange(ctx: Context, key: (string | number)[], limit: number, reverse?: boolean) {
        let res = await this.namespace.range(ctx, this.connection, key, { limit, reverse });
        return res.map((v) => this.doCreateEntity(ctx, v.item, false));
    }

    protected async _findRangeWithCursor(ctx: Context, key: (string | number)[], limit: number, after?: string, reverse?: boolean) {
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
    }

    protected async _findRangeAfter(ctx: Context, subspace: (string | number)[], after: any, limit?: number, reverse?: boolean) {
        let res = await this.namespace.rangeAfter(ctx, this.connection, subspace, [...this.namespace.namespace, ...subspace, after], { limit, reverse });
        return res.map((v) => this.doCreateEntity(ctx, v.item, false));
    }

    protected _createStream(ctx: Context, subspace: (string | number)[], limit: number, after?: string): FStream<T> {
        return new FStream(this, subspace, limit, (s) => this.doCreateEntity(ctx, s, false), after);
    }
    protected _createLiveStream(ctx: Context, subspace: (string | number)[], limit: number, after?: string): AsyncIterable<FLiveStreamItem<T>> {
        return new FLiveStream<T>(new FStream(this, subspace, limit, (s) => this.doCreateEntity(ctx, s, false), after)).generator();
    }

    protected async _findAll(ctx: Context, key: (string | number)[]) {
        let res = await this.namespace.range(ctx, this.connection, key);
        return res.map((v) => this.doCreateEntity(ctx, v.item, false));
    }

    protected async _create(parent: Context, key: (string | number)[], value: any) {
        return await tracer.trace(parent, 'Create:' + this.name, async (ctx) => {
            let cache = FTransactionContext.get(parent);
            if (!cache) {
                throw Error('Tried to create object outside of transaction');
            }
            let cacheKey = FKeyEncoding.encodeKeyToString([...this.namespace.namespace, ...key]);
            return await cache.lock(cacheKey, async () => {
                if (await this._findByIdInternal(ctx, key, false)) {
                    throw Error('Object with id ' + [...this.namespace.namespace, ...key].join('.') + ' already exists');
                }
                let res = this.doCreateEntity(ctx, value, true);
                await res.flush();
                return res;
            });
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

    private async  _findByIdInternal(parent: Context, key: (string | number)[], external: boolean) {

        // Cached
        let cache = FTransactionContext.get(parent) || FCacheContextContext.get(parent);
        if (cache) {
            let cacheKey = FKeyEncoding.encodeKeyToString([...this.namespace.namespace, ...key]);
            // console.warn(cacheKey);
            if (!external) {
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
            } else {
                return await cache.lock(cacheKey, async () => {
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
                        return res;
                    }
                });
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
}