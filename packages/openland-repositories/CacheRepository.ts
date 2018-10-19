import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';

export class CacheRepository<T> {

    readonly service: string;

    constructor(service: string) {
        this.service = service;
    }

    async read(key: string): Promise<T | null> {
        let ex = await FDB.ServiceCache.findById(this.service, key);
        if (ex) {
            return JSON.parse(ex.value) as any;
        }
        return null;
    }

    async write(key: string, value: T) {
        await inTx(async () => {
            let ex = await FDB.ServiceCache.findById(this.service, key);
            if (!ex) {
                await FDB.ServiceCache.create(this.service, key, { value: JSON.stringify(value) });
            }
        });
    }
}