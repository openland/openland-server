import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';

export class CacheRepository<T> {

    readonly service: string;

    constructor(service: string) {
        this.service = service;
    }

    async read(ctx: Context, key: string): Promise<T | null> {
        let ex = await Store.ServiceCache.findById(ctx, this.service, key);
        if (ex && ex.value) {
            return JSON.parse(ex.value) as any;
        }
        return null;
    }

    async write(parent: Context, key: string, value: T) {
        await inTx(parent, async (ctx) => {
            let ex = await Store.ServiceCache.findById(ctx, this.service, key);
            if (!ex) {
                await Store.ServiceCache.create(ctx, this.service, key, { value: JSON.stringify(value) });
            } else {
                ex.value = JSON.stringify(value);
            }
        });
    }

    async delete(parent: Context, key: string) {
        await inTx(parent, async (ctx) => {
            let ex = await Store.ServiceCache.findById(ctx, this.service, key);
            if (ex) {
                ex.value = null;
            }
        });
    }

    async deleteAll(parent: Context) {
        await inTx(parent, async (ctx) => {
            let all = await Store.ServiceCache.fromService.findAll(ctx, this.service);
            for (let entry of all) {
                entry.value = null;
            }
        });
    }

    async getCreationTime(ctx: Context, key: string): Promise<number | null> {
        let ex = await Store.ServiceCache.findById(ctx, this.service, key);
        if (ex) {
            return ex.metadata.updatedAt;
        }
        return null;
    }
}