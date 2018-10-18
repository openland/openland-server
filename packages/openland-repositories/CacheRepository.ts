import { FDB } from 'openland-server/sources/FDB';
import { inTx } from 'foundation-orm/inTx';

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
            FDB.ServiceCache.createOrUpdate(this.service, key, { value: JSON.stringify(value) });
        });
    }
}