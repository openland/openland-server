import { createHash } from 'crypto';
import { CacheRepository } from '../openland-module-cache/CacheRepository';
import { createNamedContext } from '@openland/context';
import { inTx } from '@openland/foundationdb';

export interface QueryCache {
    store(query: string): Promise<string>;
    get(queryId: string): Promise<string|null>;
}

const md5 = (data: string) => createHash('md5').update(data).digest('hex');

export class InMemoryQueryCache implements QueryCache {
    private cache = new Map<string, string>();

    async store(query: string) {
        let queryId = md5(query);
        this.cache.set(queryId, query);
        return queryId;
    }

    async get(queryId: string) {
        return this.cache.get(queryId) || null;
    }
}

const rootCtx = createNamedContext('apollo_query_cache');

export class PersistanceQueryCache implements QueryCache {
    private cache = new CacheRepository<{ query: string }>('apollo_query_cache');
    async store(query: string) {
        return inTx(rootCtx, async ctx => {
            let queryId = md5(query);
            await this.cache.write(ctx, queryId, { query });
            return queryId;
        });
    }

    async get(queryId: string) {
        let stored = await this.cache.read(rootCtx, queryId);
        if (stored) {
            return stored.query;
        } else {
            return null;
        }
    }
}