import { DB } from '../tables/index';

let cache = new Map<string, number | null>();

export class AccountRepository {
    async resolveAccount(domain: string): Promise<number> {
        domain = domain.toLocaleLowerCase();
        if (cache.has(domain)) {
            let r = cache.get(domain);
            if (r !== null && r !== undefined) {
                return r;
            } else {
                throw Error('Unknown city ' + domain);
            }
        } else {
            let account = await DB.Account.findOne({ where: { slug: domain } });
            if (account !== null) {
                cache.set(domain, account.id!!);
                return account.id!!;
            } else {
                cache.set(domain, null);
                throw Error('Unknown city ' + domain);
            }
        }
    }
}