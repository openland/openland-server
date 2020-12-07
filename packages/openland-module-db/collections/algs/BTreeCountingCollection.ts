import { Context } from '@openland/context';
import { Subspace } from '@openland/foundationdb';
import { Algorithm } from './Algorithm';
import { BPlusTreeDirectory } from './btree2/BPlusTreeDirectory';

export class BTreeCountingCollection implements Algorithm {
    readonly subspace: Subspace;
    readonly btree: BPlusTreeDirectory;

    constructor(subspace: Subspace, maxBranches: number) {
        this.subspace = subspace;
        this.btree = new BPlusTreeDirectory(subspace, maxBranches);
    }

    async add(ctx: Context, collection: Buffer, id: number) {
        await this.btree.add(ctx, collection, id);
    }
    async remove(ctx: Context, collection: Buffer, id: number) {
        // TODO: Implement
    }

    async count(ctx: Context, collection: Buffer, cursor: { from?: number | null, to?: number | null }) {
        return this.btree.count(ctx, collection, cursor);
    }
}