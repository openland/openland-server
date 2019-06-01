import Transaction from 'foundationdb/dist/lib/transaction';
import { Context } from 'openland-utils/Context';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { keySelector } from 'foundationdb';

interface RangeOptions {
    after?: Buffer;
    limit?: number;
    reverse?: boolean;
}

export class TransactionWrapper {
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

    //
    // Atomic Mutations
    //

    atomicAdd(key: Buffer, value: Buffer) {
        if (this.tx.isSnapshot) {
            throw Error('Trying to write to read-only transaction');
        }
        this.tx.add(key, value);
    }

    atomicAnd(key: Buffer, value: Buffer) {
        if (this.tx.isSnapshot) {
            throw Error('Trying to write to read-only transaction');
        }
        this.tx.bitAnd(key, value);
    }

    atomicOr(key: Buffer, value: Buffer) {
        if (this.tx.isSnapshot) {
            throw Error('Trying to write to read-only transaction');
        }
        this.tx.bitOr(key, value);
    }

    atomicXor(key: Buffer, value: Buffer) {
        if (this.tx.isSnapshot) {
            throw Error('Trying to write to read-only transaction');
        }
        this.tx.bitXor(key, value);
    }

    //
    // Lifecycle
    //

    async abort() {
        await this.tx.rawCancel();
    }

    async commit() {
        await this.tx.rawCommit();
    }

    async handleError(code: number) {
        await this.tx.rawOnError(code);
    }

    //
    // Hooks
    //

    beforeCommit(callback: (ctx: Context) => void) {
        if (this.tx.isSnapshot) {
            throw Error('Trying to write to read-only context');
        }
        // TODO: Implement
    }

    afterCommit(callback: (ctx: Context) => void) {
        if (this.tx.isSnapshot) {
            throw Error('Trying to write to read-only context');
        }
        // TODO: Implement
    }
}