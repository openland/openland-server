import { Context } from "@openland/context";
import { encoders, Subspace } from "@openland/foundationdb";

const INDEX_PRIMARY = 0;

export class CountingCollection {
    private readonly subspace: Subspace;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
    }

    //
    // Mutations
    //

    async add(ctx: Context, collection: string | number, item: number) {
        let existing = await this.subspace.get(ctx, encoders.tuple.pack([collection, INDEX_PRIMARY, item]));
        if (existing) {
            return;
        }

        // Update primary index
        this.subspace.set(ctx, encoders.tuple.pack([collection, INDEX_PRIMARY, item]), encoders.tuple.pack([]));

        // TODO: Update secondary index
    }

    async remove(ctx: Context, collection: string | number, item: number) {
        let existing = await this.subspace.get(ctx, encoders.tuple.pack([collection, INDEX_PRIMARY, item]));
        if (!existing) {
            return;
        }

        // Update primary index
        this.subspace.clear(ctx, encoders.tuple.pack([collection, INDEX_PRIMARY, item]));

        // TODO: Update secondary index
    }

    //
    // Querying
    //

    async count(ctx: Context, collection: string | number, after: number) {
        return await this.countPrimary(ctx, collection, after);
    }

    async hasAny(ctx: Context, collection: string | number, after: number) {
        return (await this.count(ctx, collection, after)) > 0;
    }

    //
    // Implementation
    //

    private async countPrimary(ctx: Context, collection: string | number, after: number) {
        return (await this.subspace.range(ctx, encoders.tuple.pack([collection, INDEX_PRIMARY]), { after: encoders.tuple.pack([collection, INDEX_PRIMARY, after]) })).length;
    }
}