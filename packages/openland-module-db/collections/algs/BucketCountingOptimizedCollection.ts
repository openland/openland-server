import { encoders, getTransaction, inTx, keyIncrement, Subspace, TupleItem } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Algorithm } from './Algorithm';
import { binarySearch } from './utils/binarySearch';

const SUBSPACE_BUCKET = 0;
const SUBSPACE_COUNTER = 1;

const INT_MINUS_ONE = encoders.int32LE.pack(-1);
const INT_PLUS_ONE = encoders.int32LE.pack(1);

export class BucketCountingOptimizedCollection implements Algorithm {
    private bucketSize: number;
    private directory: Subspace<TupleItem[], Buffer>;

    constructor(directory: Subspace<Buffer, Buffer>, bucketSize: number) {
        this.directory = directory
            .withKeyEncoding(encoders.tuple);

        this.bucketSize = bucketSize;
    }

    add = async (parent: Context, collection: Buffer, id: number) => {
        return await inTx(parent, async (ctx) => {
            if (id < 0) {
                throw Error('Id could not be less than zero');
            }

            let bucketNo = Math.ceil(id / this.bucketSize);
            let bucket = (await this.directory.get(ctx, [collection, SUBSPACE_BUCKET, bucketNo]));
            let bucketValue: number[] = [];
            if (bucket) {
                bucketValue = encoders.tuple.unpack(bucket) as number[];
                if (bucketValue.includes(id)) {
                    return;
                }

                // Update value
                let newValue = [...bucketValue, id] as number[];
                newValue.sort((a, b) => a - b);
                this.directory.set(ctx, [collection, SUBSPACE_BUCKET, bucketNo], encoders.tuple.pack(newValue));
            } else {

                // Update sorted
                this.directory.set(ctx, [collection, SUBSPACE_BUCKET, bucketNo], encoders.tuple.pack([id]));
            }

            // Update counter
            this.directory.add(ctx, [collection, SUBSPACE_COUNTER, bucketNo], INT_PLUS_ONE);
        });
    }

    remove = async (parent: Context, collection: Buffer, id: number) => {
        return await inTx(parent, async (ctx) => {
            if (id < 0) {
                throw Error('Id could not be less than zero');
            }

            let bucketNo = Math.ceil(id / this.bucketSize);
            let bucket = (await this.directory.get(ctx, [collection, SUBSPACE_BUCKET, bucketNo]));
            let bucketValue: number[] = [];
            if (bucket) {
                bucketValue = encoders.tuple.unpack(bucket) as number[];
                if (binarySearch(bucketValue, id) < 0) {
                    return;
                }
                return;
            }

            this.directory.set(ctx, [collection, SUBSPACE_BUCKET, bucketNo], encoders.tuple.pack(bucketValue.filter(v => v !== id)));

            // Update counter
            this.directory.add(ctx, [collection, SUBSPACE_COUNTER, bucketNo], INT_MINUS_ONE);
        });
    }

    count = async (ctx: Context, collection: Buffer, cursor: { from?: number | null, to?: number | null }) => {

        // If no from and to specified
        if ((cursor.from === null || cursor.from === undefined) && (cursor.to === null || cursor.to === undefined)) {
            let allBucketCounters = await this.directory.range(ctx, [collection, SUBSPACE_COUNTER]);
            let counters = allBucketCounters.map((v) => encoders.int32LE.unpack(v.value));
            let res = 0;
            for (let c of counters) {
                res += c;
            }
            return res;
        }

        // Resolve offsets
        let fromBuffer: Buffer;
        let toBuffer: Buffer;
        if (cursor.from !== null && cursor.from !== undefined) {
            let bucketNo = Math.ceil(cursor.from / this.bucketSize);
            fromBuffer = Buffer.concat([this.directory.prefix, encoders.tuple.pack([collection, SUBSPACE_BUCKET, bucketNo])]);
        } else {
            fromBuffer = Buffer.concat([this.directory.prefix, encoders.tuple.pack([collection, SUBSPACE_BUCKET])]);
        }
        if (cursor.to !== null && cursor.to !== undefined) {
            let bucketNo = Math.ceil(cursor.to / this.bucketSize);
            toBuffer = keyIncrement(Buffer.concat([this.directory.prefix, encoders.tuple.pack([collection, SUBSPACE_BUCKET, bucketNo])]));
        } else {
            toBuffer = keyIncrement(Buffer.concat([this.directory.prefix, encoders.tuple.pack([collection, SUBSPACE_BUCKET])]));
        }

        // Read all keys
        let tx = getTransaction(ctx).rawTransaction(this.directory.db);
        let batches = await tx.getRangeAll(fromBuffer, toBuffer);
        let all = ([] as TupleItem[]).concat(...(batches.map(v => encoders.tuple.unpack(v[1]))));
        if (cursor.from !== null && cursor.from !== undefined) {
            all = all.filter(id => id! >= cursor.from!);
        }
        if (cursor.to !== null && cursor.to !== undefined) {
            all = all.filter(id => id! <= cursor.to!);
        }
        return all.length;
    }
}