import { DB } from '../tables/index';

let cache = new Map<string, number | null>();

export class AccountRepository {
    async resolveArea(domain: string): Promise<{ id: number, slug: string }> {
        domain = domain.toLocaleLowerCase();
        if (cache.has(domain)) {
            let r = cache.get(domain);
            if (r !== null && r !== undefined) {
                return { id: r, slug: domain };
            } else {
                throw Error('Unknown city ' + domain);
            }
        } else {
            let account = await DB.Account.findOne({ where: { slug: domain } });
            if (account !== null) {
                cache.set(domain, account.id!!);
                return { id: account.id!!, slug: domain };
            } else {
                cache.set(domain, null);
                throw Error('Unknown city ' + domain);
            }
        }
    }
}