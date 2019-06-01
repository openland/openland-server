import { FConnection } from '../FConnection';
import { Context } from 'openland-utils/Context';
import { getTransaction } from '../getTransaction';
import { FKeyEncoding } from '../utils/FKeyEncoding';
import { keySelector } from 'foundationdb';
import { FOperations } from 'foundation-orm/FOperations';

interface RangeOptions {
    after?: Buffer;
    limit?: number;
    reverse?: boolean;
}

export class FOperationsGlobal implements FOperations {
    readonly connection: FConnection;

    constructor(connection: FConnection) {
        this.connection = connection;
    }

    async get(ctx: Context, key: Buffer) {
        let tx = getTransaction(ctx).rawTransaction(this.connection);
        return await tx.get(key);
    }

    async range(ctx: Context, key: Buffer, opts?: RangeOptions) {
        let tx = getTransaction(ctx).rawTransaction(this.connection);
        if (opts && opts.after) {
            let after = opts.after!;
            let reversed = (opts && opts.reverse) ? true : false;
            let start = reversed ? FKeyEncoding.firstKeyInSubspaceBuf(key) : keySelector.firstGreaterThan(FKeyEncoding.lastKeyInSubspaceBuf(after));
            let end = reversed ? after : FKeyEncoding.lastKeyInSubspaceBuf(key);
            return (await tx.getRangeAll(start, end, {
                limit: opts && opts.limit ? opts.limit! : undefined,
                reverse: opts && opts.reverse ? opts.reverse : undefined
            })).map((v) => ({ key: v[0], value: v[1] }));
        } else {
            return (await tx.getRangeAll(key, undefined, {
                limit: opts && opts.limit ? opts.limit! : undefined,
                reverse: opts && opts.reverse ? opts.reverse : undefined
            })).map((v) => ({ key: v[0], value: v[1] }));
        }
    }

    set(ctx: Context, key: Buffer, value: Buffer) {
        let tx = getTransaction(ctx).rawTransaction(this.connection);
        tx.set(key, value);
    }

    delete(ctx: Context, key: Buffer) {
        let tx = getTransaction(ctx).rawTransaction(this.connection);
        tx.clear(key);
    }

    add(ctx: Context, key: Buffer, value: Buffer) {
        let tx = getTransaction(ctx).rawTransaction(this.connection);
        tx.add(key, value);
    }

    or(ctx: Context, key: Buffer, value: Buffer) {
        let tx = getTransaction(ctx).rawTransaction(this.connection);
        tx.bitOr(key, value);
    }

    xor(ctx: Context, key: Buffer, value: Buffer) {
        let tx = getTransaction(ctx).rawTransaction(this.connection);
        tx.bitXor(key, value);
    }
}