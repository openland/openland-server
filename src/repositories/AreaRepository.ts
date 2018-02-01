import { DB } from '../tables/index';

export class AreaRepository {
    private cache = new Map<string, number | null>();
    async resolveArea(domain: string): Promise<{ id: number, slug: string }> {
        domain = domain.toLocaleLowerCase();
        if (this.cache.has(domain)) {
            let r = this.cache.get(domain);
            if (r !== null && r !== undefined) {
                return { id: r, slug: domain };
            } else {
                throw Error('Unknown city ' + domain);
            }
        } else {
            let account = await DB.Account.findOne({ where: { slug: domain } });
            if (account !== null) {
                this.cache.set(domain, account.id!!);
                return { id: account.id!!, slug: domain };
            } else {
                this.cache.set(domain, null);
                throw Error('Unknown city ' + domain);
            }
        }
    }
}