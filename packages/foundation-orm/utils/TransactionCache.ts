import { Context } from '@openland/context';
import { getTransaction } from '@openland/foundationdb';

export class TransactionCache<T> {
    
    readonly key: string;
    constructor(key: string) {
        this.key = key;
    }

    get(ctx: Context, cacheKey: string): T | null {
        let tx = getTransaction(ctx);
        let ex = tx.userData.get(this.key);
        if (ex) {
            let exm = ex as Map<string, T>;
            let r = exm.get(cacheKey);
            if (r) {
                return r;
            }
        }
        return null;
    }

    set(ctx: Context, cacheKey: string, value: T) {
        let tx = getTransaction(ctx);
        let ex = tx.userData.get(this.key);
        if (ex) {
            let exm = ex as Map<string, T>;
            exm.set(cacheKey, value);
        } else {
            let exm = new Map<string, T>();
            exm.set(cacheKey, value);
            tx.userData.set(this.key, exm);
        }
    }
}