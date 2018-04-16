import { DB } from '../tables';
import { Transaction } from 'sequelize';

export class CacheRepository<T> {
    service: string;

    constructor(service: string) {
        this.service = service;
    }

    async read(key: string, tx?: Transaction): Promise<T | null> {
        let ex = await DB.ServicesCache.findOne({ where: { service: this.service, key: key }, transaction: tx });
        if (ex) {
            return ex.content!! as any;
        }
        return null;
    }

    async write(key: string, value: T, tx?: Transaction) {
        await DB.ServicesCache.upsert({
            service: this.service,
            key: key,
            content: value as any
        }, { transaction: tx });
    }
}