import { FConnection } from 'foundation-orm/FConnection';
import { getTransaction } from 'foundation-orm/getTransaction';
import { Context } from 'openland-utils/Context';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { keySelector } from 'foundationdb';
import { FRangeOptions } from 'foundation-orm/FRangeOptions';
import { FOperations } from 'foundation-orm/FOperations';
import { FTransformer } from 'foundation-orm/FTransformer';
import { FTransformedOperations } from './FTransformedOperations';
import { FEncoders } from 'foundation-orm/FEncoders';

export class FSubspaceOperations implements FOperations<Buffer, Buffer> {

    readonly connection: FConnection;
    readonly prefix: Buffer;

    constructor(connection: FConnection, prefix: Buffer) {
        this.connection = connection;
        this.prefix = prefix;
    }

    withKeyEncoding<K2>(keyTf: FTransformer<Buffer, K2>): FOperations<K2, Buffer> {
        return new FTransformedOperations<K2, Buffer, Buffer, Buffer>(this, keyTf, FEncoders.id<Buffer>());
    }
    withValueEncoding<V2>(valueTf: FTransformer<Buffer, V2>): FOperations<Buffer, V2> {
        return new FTransformedOperations<Buffer, V2, Buffer, Buffer>(this, FEncoders.id<Buffer>(), valueTf);
    }

    subspace(key: Buffer): FOperations<Buffer, Buffer> {
        return new FSubspaceOperations(this.connection, Buffer.concat([this.prefix, key]));
    }

    async get(ctx: Context, key: Buffer) {
        let tx = getTransaction(ctx).rawTransaction(this.connection);
        return await tx.get(Buffer.concat([this.prefix, key]));
    }

    async range(ctx: Context, key: Buffer, opts?: FRangeOptions<Buffer>) {
        let tx = getTransaction(ctx).rawTransaction(this.connection);
        if (opts && opts.after) {
            let keyR = Buffer.concat([this.prefix, key]);
            let after = Buffer.concat([this.prefix, key, opts.after!]);
            let reversed = (opts && opts.reverse) ? true : false;
            let start = reversed ? FKeyEncoding.firstKeyInSubspaceBuf(keyR) : keySelector.firstGreaterThan(FKeyEncoding.lastKeyInSubspaceBuf(after));
            let end = reversed ? after : FKeyEncoding.lastKeyInSubspaceBuf(keyR);
            return (await tx.getRangeAll(start, end, {
                limit: opts && opts.limit ? opts.limit! : undefined,
                reverse: opts && opts.reverse ? opts.reverse : undefined
            })).map((v) => ({ key: v[0].slice(this.prefix.length), value: v[1] }));
        } else {
            return (await tx.getRangeAll(Buffer.concat([this.prefix, key]), undefined, {
                limit: opts && opts.limit ? opts.limit! : undefined,
                reverse: opts && opts.reverse ? opts.reverse : undefined
            })).map((v) => ({ key: v[0].slice(this.prefix.length), value: v[1] }));
        }
    }

    set(ctx: Context, key: Buffer, value: Buffer) {
        let tx = getTransaction(ctx).rawTransaction(this.connection);
        tx.set(Buffer.concat([this.prefix, key]), value);
    }

    delete(ctx: Context, key: Buffer) {
        let tx = getTransaction(ctx).rawTransaction(this.connection);
        tx.clear(Buffer.concat([this.prefix, key]));
    }

    add(ctx: Context, key: Buffer, value: Buffer) {
        let tx = getTransaction(ctx).rawTransaction(this.connection);
        tx.add(Buffer.concat([this.prefix, key]), value);
    }

    or(ctx: Context, key: Buffer, value: Buffer) {
        let tx = getTransaction(ctx).rawTransaction(this.connection);
        tx.bitOr(Buffer.concat([this.prefix, key]), value);
    }

    xor(ctx: Context, key: Buffer, value: Buffer) {
        let tx = getTransaction(ctx).rawTransaction(this.connection);
        tx.bitXor(Buffer.concat([this.prefix, key]), value);
    }
}