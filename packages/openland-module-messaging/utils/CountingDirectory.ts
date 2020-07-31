import { Subspace, TupleItem, inTx, getTransaction } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { encoders } from '@openland/foundationdb';

export class CountingDirectory {

    private directory: Subspace<TupleItem[], boolean>;

    constructor(directory: Subspace<Buffer, Buffer>) {
        this.directory = directory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean);
    }

    add = (ctx: Context, collection: number, id: number) => {
        if (id <= 0) {
            throw Error('Id could not be less than zero');
        }
        this.directory.set(ctx, [collection, id], false);
    }

    remove = (ctx: Context, collection: number, id: number) => {
        if (id <= 0) {
            throw Error('Id could not be less than zero');
        }
        this.directory.clear(ctx, [collection, id]);
    }

    count = async (parent: Context, collection: number, cursor: { from?: number | null, to?: number | null }) => {
        return await inTx(parent, async (ctx) => {

            // Resolve offsets 
            let fromBuffer: Buffer;
            let toBuffer: Buffer;
            if (cursor.from !== null && cursor.from !== undefined) {
                fromBuffer = Buffer.concat([this.directory.prefix, encoders.tuple.pack([collection, cursor.from])]);
            } else {
                fromBuffer = Buffer.concat([this.directory.prefix, encoders.tuple.pack([collection])]);
            }
            if (cursor.to !== null && cursor.to !== undefined) {
                toBuffer = Buffer.concat([this.directory.prefix, encoders.tuple.pack([collection, cursor.to + 1])]);
            } else {
                toBuffer = Buffer.concat([this.directory.prefix, encoders.tuple.pack([collection + 1])]);
            }

            // Read all keys
            let tx = getTransaction(ctx).rawTransaction(this.directory.db);
            let all = await tx.getRangeAll(fromBuffer, toBuffer);
            return all.length;
        });
    }
}