import { createHash } from 'crypto';
import { CacheRepository } from '../openland-module-cache/CacheRepository';
import { createNamedContext } from '@openland/context';
import { inTx } from '@openland/foundationdb';

export interface QueryCache {
    store(query: { query: string, name: string | undefined }): Promise<string>;

    get(queryId: string): Promise<{ query: string, name: string | undefined } | null>;
}

const sha256 = (data: string) => createHash('sha256').update(data).digest('hex');

export class InMemoryQueryCache implements QueryCache {
    private cache = new Map<string, string>();

    async store(query: { query: string, name: string | undefined }) {
        let operation = JSON.stringify(query);
        let queryId = sha256(operation);
        this.cache.set(queryId, operation);
        return queryId;
    }

    async get(queryId: string) {
        if (this.cache.has(queryId)) {
            return JSON.parse(this.cache.get(queryId)!);
        } else {
            return null;
        }
    }
}

const rootCtx = createNamedContext('apollo_query_cache');

export class PersistanceQueryCache implements QueryCache {
    private cache = new CacheRepository<{ query: string, name: string | undefined }>('apollo_query_cache');

    async store(query: { query: string, name: string | undefined }) {
        return inTx(rootCtx, async ctx => {
            let operation = JSON.stringify(query);
            let queryId = sha256(operation);
            await this.cache.write(ctx, queryId, query);
            return queryId;
        });
    }

    async get(queryId: string) {
        let stored = await this.cache.read(rootCtx, queryId);
        if (stored) {
            return stored;
        } else {
            return null;
        }
    }
}
