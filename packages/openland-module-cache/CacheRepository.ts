import { transactional } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';

export class CacheRepository<T> {

    readonly service: string;

    constructor(service: string) {
        this.service = service;
    }

    @transactional
    async read(ctx: Context, key: string): Promise<T | null> {
        let ex = await Store.ServiceCache.findById(ctx, this.service, key);
        if (ex && ex.value) {
            return JSON.parse(ex.value) as any;
        }
        return null;
    }

    @transactional
    async write(ctx: Context, key: string, value: T) {

        let ex = await Store.ServiceCache.findById(ctx, this.service, key);
        if (!ex) {
            await Store.ServiceCache.create(ctx, this.service, key, { value: JSON.stringify(value) });
        } else {
            ex.value = JSON.stringify(value);
        }
    }

    @transactional
    async delete(ctx: Context, key: string) {
        let ex = await Store.ServiceCache.findById(ctx, this.service, key);
        if (ex) {
            ex.value = null;
        }
    }

    @transactional
    async deleteAll(ctx: Context) {
        Store.ServiceCache.descriptor.subspace.clearPrefixed(ctx, [this.service]);
        Store.ServiceCache.descriptor.secondaryIndexes[0].subspace.clearPrefixed(ctx, [this.service]);
    }

    @transactional
    async getCreationTime(ctx: Context, key: string): Promise<number | null> {
        let ex = await Store.ServiceCache.findById(ctx, this.service, key);
        if (ex) {
            return ex.metadata.updatedAt;
        }
        return null;
    }
}