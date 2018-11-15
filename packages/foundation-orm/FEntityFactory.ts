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
import { FCacheContext } from './FCacheContext';
import { FTransaction } from './FTransaction';
import { createTracer } from 'openland-log/createTracer';
import { STracer } from 'openland-log/STracer';
import { withTracing } from 'openland-log/withTracing';
import { Context } from 'openland-utils/Context';

const log = createLogger('entity-factory');

export abstract class FEntityFactory<T extends FEntity> {
    readonly namespace: FNamespace;
    readonly directory: FDirectory;
    readonly connection: FConnection;
    readonly options: FEntityOptions;
    readonly indexes: FEntityIndex[];
    readonly name: string;
    private watcher: FWatch;
    private tracer: STracer;

    constructor(connection: FConnection, namespace: FNamespace, options: FEntityOptions, indexes: FEntityIndex[], name: string) {
        this.tracer = createTracer(name);
        this.namespace = namespace;
        this.directory = connection.getDirectory(namespace.namespace);
        this.connection = connection;
        this.options = options;
        this.indexes = indexes;
        this.name = name;
        this.watcher = new FWatch(connection);
    }

    async findByRawId(ctx: Context, key: (string | number)[]) {
        let res = await this.namespace.get(this.connection, key);
        if (res) {
            return this.doCreateEntity(ctx, res, false);
        }
        return null;
    }

    async findAll(ctx: Context) {
        return (await this.directory.range([])).map((v) => this.doCreateEntity(ctx, v, false));
    }

    async findAllKeys(ctx: Context, limit?: number) {
        let res = await this.namespace.range(this.connection, [], { limit });
        res = res.filter((v) => !FKeyEncoding.decodeKey(v.key).find((k) => k === '__indexes'));
        return res.map((v) => v.key);
    }

    async findAllKeysAfter(ctx: Context, after: any[], limit?: number) {
        let res = await this.namespace.rangeAfter(this.connection, [], after, { limit });
        res = res.filter((v) => !FKeyEncoding.decodeKey(v.key).find((k) => k === '__indexes'));
        return res.map((v) => v.key);
    }

    async findAllWithIds(ctx: Context) {
        let res = await this.namespace.range(this.connection, []);
        return res.map((v) => ({ item: this.doCreateEntity(ctx, v.item, false), key: v.key }));
    }

    abstract extractId(rawId: any[]): any;

    protected abstract _createEntity(ctx: Context, value: any, isNew: boolean): T;

    protected async _findById(ctx: Context, key: (string | number)[]) {

        let cache = FCacheContext.context.value;
        if (cache && !FTransaction.context.value) {
            return await withTracing(this.tracer, 'findById-cached', async () => {
                let cacheKey = FKeyEncoding.encodeKeyToString([...this.namespace.namespace, ...key]);
                let cached = cache!.findInCache(cacheKey);
                if (cached !== undefined) {
                    return await (cached as Promise<T | null>);
                }

                let res: Promise<T | null> = (async () => {
                    let r = await this.namespace.get(this.connection, key);
                    if (r) {
                        return this.doCreateEntity(ctx, r, false);
                    } else {
                        return null;
                    }
                })();
                cache!.putInCache(cacheKey, res);
                return await res;
            });
        } else {
            return await withTracing(this.tracer, 'findById', async () => {
                let res = await this.namespace.get(this.connection, key);
                if (res) {
                    return this.doCreateEntity(ctx, res, false);
                }
                return null;
            });
        }
    }

    protected async _findFromIndex(ctx: Context, key: (string | number)[]) {
        // let res = await this.directory.get(key);
        let res = await this.namespace.get(this.connection, key);
        if (res) {
            return this.doCreateEntity(ctx, res, false);
        }
        return null;
    }

    protected async _findRangeAllAfter(ctx: Context, key: (string | number)[], after: any, reverse?: boolean) {
        let res = await this.namespace.rangeAfter(this.connection, key, [...this.namespace.namespace, ...key, after], { reverse });
        return res.map((v) => this.doCreateEntity(ctx, v.item, false));
    }

    protected async _findRange(ctx: Context, key: (string | number)[], limit: number, reverse?: boolean) {
        let res = await this.namespace.range(this.connection, key, { limit, reverse });
        return res.map((v) => this.doCreateEntity(ctx, v.item, false));
    }

    protected async _findRangeWithCursor(ctx: Context, key: (string | number)[], limit: number, after?: string, reverse?: boolean) {
        if (after) {
            let res = await this.namespace.rangeAfter(this.connection, key, FKeyEncoding.decodeFromString(after) as any, { limit: limit + 1, reverse });
            let d: T[] = [];
            let cursor: string | undefined;
            for (let i = 0; i < Math.min(limit, res.length); i++) {
                d.push(this._createEntity(ctx, res[i].item, false));
            }
            if (res.length > limit) {
                cursor = FKeyEncoding.encodeKeyToString(FKeyEncoding.decodeKey(res[res.length - 2].key) as any);
            }
            return { items: d, cursor };
        } else {
            let res = await this.namespace.range(this.connection, key, { limit: limit + 1, reverse });
            let d: T[] = [];
            let cursor: string | undefined;
            for (let i = 0; i < Math.min(limit, res.length); i++) {
                d.push(this._createEntity(ctx, res[i].item, false));
            }
            if (res.length > limit) {
                cursor = FKeyEncoding.encodeKeyToString(FKeyEncoding.decodeKey(res[res.length - 2].key) as any);
            }
            return { items: d, cursor };
        }
    }

    protected async _findRangeAfter(ctx: Context, subspace: (string | number)[], after: any, limit?: number, reverse?: boolean) {
        let res = await this.namespace.rangeAfter(this.connection, subspace, [...this.namespace.namespace, ...subspace, after], { limit, reverse });
        return res.map((v) => this.doCreateEntity(ctx, v.item, false));
    }

    protected _createStream(ctx: Context, subspace: (string | number)[], limit: number, after?: string): FStream<T> {
        return new FStream(this, subspace, limit, (s) => this.doCreateEntity(ctx, s, false), after);
    }
    protected _createLiveStream(ctx: Context, subspace: (string | number)[], limit: number, after?: string): AsyncIterator<FLiveStreamItem<T>> {
        return new FLiveStream<T>(new FStream(this, subspace, limit, (s) => this.doCreateEntity(ctx, s, false), after)).generator();
    }

    protected async _findAll(ctx: Context, key: (string | number)[]) {
        let res = await this.namespace.range(this.connection, key);
        return res.map((v) => this.doCreateEntity(ctx, v.item, false));
    }

    protected async _create(ctx: Context, key: (string | number)[], value: any) {
        if (await this._findById(ctx, key)) {
            throw Error('Object with id ' + [...this.namespace.namespace, ...key].join('.') + ' already exists');
        }
        let res = this.doCreateEntity(ctx, value, true);
        await res.flush();
        return res;
    }

    protected _watch(ctx: Context, key: (string | number)[], cb: () => void) {
        let fullKey = [...this.namespace.namespace, ...key];

        return this.watcher.watch(ctx, fullKey, cb);
    }

    public doCreateEntity(ctx: Context, value: any, isNew: boolean): T {
        try {
            this.options.validator(value);
            return this._createEntity(ctx, value, isNew);
        } catch (e) {
            log.warn(ctx, 'Unable to create entity from ', JSON.stringify(value), e);
            throw e;
        }
    }
}