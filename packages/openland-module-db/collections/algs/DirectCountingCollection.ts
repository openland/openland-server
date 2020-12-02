import { Subspace, TupleItem, inTx, getTransaction, keyIncrement } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { encoders } from '@openland/foundationdb';
import { Algorithm } from './Algorithm';

export class DirectCountingCollection implements Algorithm {

    private directory: Subspace<TupleItem[], boolean>;

    constructor(directory: Subspace<Buffer, Buffer>) {
        this.directory = directory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean);
    }

    add = async (ctx: Context, collection: Buffer, id: number) => {
        if (id < 0) {
            throw Error('Id could not be less than zero');
        }
        this.directory.set(ctx, [collection, id], false);
    }

    remove = async (ctx: Context, collection: Buffer, id: number) => {
        if (id < 0) {
            throw Error('Id could not be less than zero');
        }
        this.directory.clear(ctx, [collection, id]);
    }

    count = async (parent: Context, collection: Buffer, cursor: { from?: number | null, to?: number | null }) => {
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
                toBuffer = keyIncrement(Buffer.concat([this.directory.prefix, encoders.tuple.pack([collection, cursor.to])]));
            } else {
                toBuffer = keyIncrement(Buffer.concat([this.directory.prefix, encoders.tuple.pack([collection])]));
            }

            // Read all keys
            let tx = getTransaction(ctx).rawTransaction(this.directory.db);
            let all = await tx.getRangeAll(fromBuffer, toBuffer);
            return all.length;
        });
    }
}