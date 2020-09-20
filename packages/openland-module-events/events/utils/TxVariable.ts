import { TransactionCache, getTransaction } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { randomKey } from 'openland-utils/random';

let txValueCache = new TransactionCache<{ value: any }>('tx-variable');

export class TxVariable<T> {
    private value: T;
    private key = randomKey();

    constructor(initial: T) {
        this.value = initial;
    }

    getWritten(): T {
        return this.value;
    }

    get(ctx: Context): T {
        let ex = txValueCache.get(ctx, this.key);
        if (ex) {
            return ex.value;
        } else {
            return this.value;
        }
    }

    set(ctx: Context, value: T) {
        let ex = txValueCache.get(ctx, this.key);
        if (ex) {
            ex.value = value;
        } else {
            let cv: { value: any } = { value };
            txValueCache.set(ctx, this.key, cv);
            getTransaction(ctx).afterCommit(() => {
                this.value = cv.value;
            });
        }
    }
}