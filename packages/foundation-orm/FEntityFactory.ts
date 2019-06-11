import { FNamespace } from './FNamespace';
import { FConnection } from './FConnection';
import { FEntity, FEntityOptions } from './FEntity';
import { FWatch } from './FWatch';
import { FEntityIndex } from './FEntityIndex';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { FStream } from './FStream';
import { FLiveStream } from './FLiveStream';
import { FLiveStreamItem } from './FLiveStreamItem';
import { Context } from '@openland/context';
import { FTransactionContext, FTransactionReadOnlyContext } from './utils/contexts';
import { tracer } from './utils/tracer';
import { FTuple } from './encoding/FTuple';
import { fixObsoleteCursor } from './utils/fixObsoleteKey';
import { FSubspace } from './FSubspace';
import { FEncoders } from './encoding/FEncoders';
import { createLogger } from '@openland/log';

const log = createLogger('fdb');

export abstract class FEntityFactory<T extends FEntity> {
    readonly namespace: FNamespace;
    readonly directory: FSubspace<FTuple[], any>;
    readonly connection: FConnection;
    readonly options: FEntityOptions;
    readonly indexes: FEntityIndex[];
    readonly name: string;
    private watcher: FWatch;
    // private tracer: STracer;

    constructor(connection: FConnection, namespace: FNamespace, options: FEntityOptions, indexes: FEntityIndex[], name: string) {
        // this.tracer = createTracer(name);
        this.namespace = namespace;
        this.directory = connection.directories.getDirectory(namespace.namespace)
            .withKeyEncoding(FEncoders.tuple)
            .withValueEncoding(FEncoders.json);
        this.connection = connection;
        this.options = options;
        this.indexes = indexes;
        this.name = name;
        this.watcher = new FWatch(connection);
    }

    async findByRawId(ctx: Context, key: (string | number)[]) {
        return this.readOp(ctx, async () => {
            let res = await this.namespace.keySpace.get(ctx, key);
            if (res) {
                return this.doCreateEntity(ctx, res, false);
            }
            return null;
        });
    }

    async findAll(ctx: Context) {
        return this.readOp(ctx, async () => (await this.directory.range(ctx, [])).map((v) => this.doCreateEntity(ctx, v.value, false)));
    }

    async findAllKeys(ctx: Context, limit?: number) {
        return this.readOp(ctx, async () => {
            let res = await this.namespace.keySpace.range(ctx, [], { limit });
            res = res.filter((v) => !v.key.find((k) => k === '__indexes'));
            return res.map((v) => v.key);
        });
    }

    // async findAllKeysAfter(ctx: Context, after: any[], limit?: number) {
    //     return this.readOp(ctx, async () => {
    //         let res = await this.namespace.rangeAfter(ctx, [], after, { limit });
    //         res = res.filter((v) => !FKeyEncoding.decodeKey(v.key).find((k) => k === '__indexes'));
    //         return res.map((v) => v.key);
    //     });
    // }

    // async findAllWithIds(ctx: Context) {
    //     return this.readOp(ctx, async () => {
    //         let res = await this.namespace.range(ctx, []);
    //         return res.map((v) => ({ item: this.doCreateEntity(ctx, v.item, false), key: v.key }));
    //     });
    // }

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
                let res = await this.namespace.keySpace.get(ctx, key);
                if (res) {
                    return this.doCreateEntity(ctx, res, false);
                }
                return null;
            });
        });
    }

    protected async _findRangeAllAfter(ctx: Context, key: (string | number)[], after: any, reverse?: boolean) {
        return this.readOp(ctx, async () => {
            let res = await this.namespace.keySpace.subspace(key).range(ctx, [], { after: [after], reverse });
            return res.map((v) => this.doCreateEntity(ctx, v.value, false));
        });
    }

    protected async _findRange(ctx: Context, key: (string | number)[], limit: number, reverse?: boolean) {
        return this.readOp(ctx, async () => {
            let res = await this.namespace.keySpace.range(ctx, key, { limit, reverse });
            return res.map((v) => this.doCreateEntity(ctx, v.value, false));
        });
    }

    protected async _findRangeWithCursor(ctx: Context, key: (string | number)[], limit: number, after?: string, reverse?: boolean) {
        return this.readOp(ctx, async () => {
            let res: { value: any, key: FTuple[] }[];
            // Using subspace for shortest possible key
            let subspace = this.namespace.keySpace.subspace(key);
            if (after) {
                // Fix old cursors
                let k = fixObsoleteCursor(FKeyEncoding.decodeFromString(after), this.namespace.namespace, key);
                res = await subspace.range(ctx, [], { limit: limit + 1, reverse, after: k });
            } else {
                res = await subspace.range(ctx, [], { limit: limit + 1, reverse });
            }
            let d: T[] = [];
            for (let i = 0; i < Math.min(limit, res.length); i++) {
                d.push(this._createEntity(ctx, res[i].value, false));
            }
            let cursor: string | undefined;
            if (res.length > 0) {
                if (res.length === limit + 1) {
                    cursor = FKeyEncoding.encodeKeyToString(res[res.length - 2].key);
                } else {
                    cursor = FKeyEncoding.encodeKeyToString(res[res.length - 1].key);
                }
            } else {
                cursor = after;
            }
            // let cursor = res.length ? FKeyEncoding.encodeKeyToString((res[Math.min(res.length - 2, limit)]).key) : after;
            let haveMore = res.length > limit;
            return { items: d, cursor, haveMore };
        });
    }

    protected async _findRangeAfter(ctx: Context, subspace: (string | number)[], after: (string | number), limit?: number, reverse?: boolean) {
        return this.readOp(ctx, async () => {
            let res = await this.namespace.keySpace
                .range(ctx, subspace, { limit, reverse, after: [after] });
            return res.map((v) => this.doCreateEntity(ctx, v.value, false));
        });
    }

    protected _createStream(subspace: (string | number)[], limit: number, after?: string): FStream<T> {
        return new FStream(this, subspace, limit, (s, ctx) => this.doCreateEntity(ctx, s, false), after);
    }
    protected _createLiveStream(ctx: Context, subspace: (string | number)[], limit: number, after?: string): AsyncIterable<FLiveStreamItem<T>> {
        return new FLiveStream<T>(new FStream(this, subspace, limit, (s, ctx2) => this.doCreateEntity(ctx2, s, false), after)).generator(ctx);
    }

    protected async _findAll(ctx: Context, key: (string | number)[]) {
        return this.readOp(ctx, async () => {
            let res = await this.namespace.keySpace.range(ctx, key);
            return res.map((v) => this.doCreateEntity(ctx, v.value, false));
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
                    throw Error('Object with id ' + [this.name, ...key].join('.') + ' already exists');
                }
                let res = this.doCreateEntity(parent, value, true);
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
            let res = this.doCreateEntity(parent, value, true);
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
            let cache = FTransactionContext.get(ctx) || FTransactionReadOnlyContext.get(ctx);
            if (cache) {
                let cacheKey = FKeyEncoding.encodeKeyToString([this.name, ...res.rawId]);
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
            log.warn(ctx, e, 'Unable to create entity from ', value);
            throw e;
        }
    }

    private async  _findByIdInternal(parent: Context, key: (string | number)[]): Promise<T | null> {

        // Cached
        let cache = FTransactionContext.get(parent) || FTransactionReadOnlyContext.get(parent);
        if (cache) {
            let cacheKey = FKeyEncoding.encodeKeyToString([this.name, ...key]);

            let cached = cache!.findInCache(cacheKey);
            if (cached) {
                return cached;
            } else {
                let res = await tracer.trace(parent, 'FindById:' + this.name, async (ctx) => {
                    let r = await this.namespace.keySpace.get(ctx, key);
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
            let res = await this.namespace.keySpace.get(ctx, key);
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
        let cache = FTransactionContext.get(ctx) || FTransactionReadOnlyContext.get(ctx);
        if (!cache) {
            // throw Error('No transaction or cache in the context!');
            return null;
        }
        return cache.readWriteLock(this.name);
    }
}