import { Context } from '@openland/context';
import { encoders, getTransaction, Subspace, TransactionCache, TupleItem } from '@openland/foundationdb';
import { createLogger } from '@openland/log';

const cachedCache = new TransactionCache<{
    cache: { [key: string]: any },
    writes: { [key: string]: any }
}>('cached-subspace');

const logger = createLogger('cached-subspace');

export class CachedSubspace<T> {

    private readonly subspace: Subspace;
    private readonly serialize: (src: T) => Buffer;
    private readonly parse: (src: Buffer) => T;
    private readonly key: string;

    constructor(subspace: Subspace,
        serialize: (src: T) => Buffer,
        parse: (src: Buffer) => T
    ) {
        this.subspace = subspace;
        this.serialize = serialize;
        this.parse = parse;
        this.key = this.subspace.prefix.toString('hex');
    }

    async read(ctx: Context, key: TupleItem[]): Promise<T | null> {
        let cache = this.getCache(ctx);
        let binKey = encoders.tuple.pack(key);
        let rawKey = binKey.toString('hex');
        if (cache.cache[rawKey] !== undefined) {
            return cache.cache[rawKey];
        }

        let ex = await this.subspace.get(ctx, binKey);
        if (!ex) {
            cache.cache[rawKey] = null;
            return null;
        }
        let parsed = this.parse(ex);
        cache.cache[rawKey] = parsed;
        return parsed;
    }

    write(ctx: Context, key: TupleItem[], value: T | null) {
        let cache = this.getCache(ctx);
        let rawKey = encoders.tuple.pack(key).toString('hex');
        let wasEmpty = Object.keys(cache.writes).length === 0;
        cache.writes[rawKey] = value;
        cache.cache[rawKey] = value;
        if (wasEmpty) {
            getTransaction(ctx).beforeCommit(async (commit) => {
                logger.log(ctx, 'dump', cache);
                for (let w of Object.keys(cache.writes)) {
                    let writeKey = Buffer.from(w, 'hex');
                    if (!cache.writes[w]) {
                        this.subspace.clear(commit, writeKey);
                    } else {
                        this.subspace.set(commit, writeKey, this.serialize(cache.writes[w]));
                    }
                }
                cache.writes = {};
            });
        }
    }

    private getCache(ctx: Context) {
        let existing = cachedCache.get(ctx, this.key);
        if (!existing) {
            existing = { cache: {}, writes: {} };
            cachedCache.set(ctx, this.key, existing);
        }
        return existing;
    }
}