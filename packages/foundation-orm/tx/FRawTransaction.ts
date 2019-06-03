import Transaction from 'foundationdb/dist/lib/transaction';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { keySelector } from 'foundationdb';

interface RangeOptions {
    after?: Buffer;
    limit?: number;
    reverse?: boolean;
}

export class FRawTransaction {
    private readonly tx: Transaction<Buffer, Buffer>;

    constructor(tx: Transaction<Buffer, Buffer>) {
        this.tx = tx;
    }

    //
    // Key Value Operations
    //

    async get(key: Buffer) {
        return await this.tx.get(key);
    }

    set(key: Buffer, value: Buffer) {
        if (this.tx.isSnapshot) {
            throw Error('Trying to write to read-only transaction');
        }
        this.tx.set(key, value);
    }

    delete(key: Buffer) {
        if (this.tx.isSnapshot) {
            throw Error('Trying to write to read-only transaction');
        }
        this.tx.clear(key);
    }

    //
    // Range Operations
    //

    async range(key: Buffer, opts?: RangeOptions) {
        if (opts && opts.after) {
            let after = opts.after!;
            let reversed = (opts && opts.reverse) ? true : false;
            let start = reversed ? FKeyEncoding.firstKeyInSubspaceBuf(key) : keySelector.firstGreaterThan(FKeyEncoding.lastKeyInSubspaceBuf(after));
            let end = reversed ? after : FKeyEncoding.lastKeyInSubspaceBuf(key);
            return (await this.tx.getRangeAll(start, end, {
                limit: opts && opts.limit ? opts.limit! : undefined,
                reverse: opts && opts.reverse ? opts.reverse : undefined
            })).map((v) => ({ key: v[0], value: v[1] }));
        } else {
            return (await this.tx.getRangeAll(key, undefined, {
                limit: opts && opts.limit ? opts.limit! : undefined,
                reverse: opts && opts.reverse ? opts.reverse : undefined
            })).map((v) => ({ key: v[0], value: v[1] }));
        }
    }
}