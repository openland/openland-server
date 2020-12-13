import { Context } from '@openland/context';
import { encoders, Subspace, TupleItem } from '@openland/foundationdb';
import { BPlusTreeDirectory } from './algs/btree2/BPlusTreeDirectory';

export class CountingCollection {
    readonly btree: BPlusTreeDirectory;

    constructor(subspace: Subspace) {
        this.btree = new BPlusTreeDirectory(subspace, 4000);
    }

    async add(ctx: Context, collection: TupleItem[], key: number) {
        await this.btree.add(ctx, encoders.tuple.pack(collection), key);
    }

    async remove(ctx: Context, collection: TupleItem[], key: number) {
        await this.btree.remove(ctx, encoders.tuple.pack(collection), key);
    }

    async count(ctx: Context, collection: TupleItem[], after: number) {
        return await this.btree.count(ctx, encoders.tuple.pack(collection), { from: after + 1 });
    }

    async hasAny(ctx: Context, collection: TupleItem[], after: number) {
        return (await this.count(ctx, collection, after)) > 0;
    }
}