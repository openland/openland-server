import { encoders, getTransaction, inTxLeaky, keyIncrement, Subspace, TransactionCache, TupleItem } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Algorithm } from './Algorithm';
import { binarySearch } from './utils/binarySearch';
import { inTxLock } from '../../../openland-module-db/inTxLock';
import { sortedArrayAdd } from './utils/sortedArrayAdd';

const SUBSPACE_BUCKET = 0;
const SUBSPACE_COUNTER = 1;

const INT_MINUS_ONE = encoders.int32LE.pack(-1);
const INT_PLUS_ONE = encoders.int32LE.pack(1);

const bucketWriteCache = new TransactionCache<{
    cache: { [key: number]: number[] },
    writes: { [key: number]: number[] }
}>('bucket-collection');

export class BucketCountingOptimizedCollection implements Algorithm {
    private bucketSize: number;
    private directory: Subspace<TupleItem[], Buffer>;

    constructor(directory: Subspace<Buffer, Buffer>, bucketSize: number) {
        this.directory = directory
            .withKeyEncoding(encoders.tuple);

        this.bucketSize = bucketSize;
    }

    add = async (parent: Context, collection: Buffer, id: number) => {
        if (id < 0) {
            throw Error('Id could not be less than zero');
        }
        return await inTxLeaky(parent, async (ctx) => {
            return await inTxLock(ctx, 'bucket-collection-' + collection.toString('hex'), async () => {
                let bucketNo = Math.ceil(id / this.bucketSize);

                // Update bucket
                let bucket = await this.readBlock(ctx, collection, bucketNo);
                if (binarySearch(bucket, id) >= 0) {
                    return;
                }
                bucket = sortedArrayAdd(bucket, id, (a, b) => a - b);
                this.writeBlock(ctx, collection, bucketNo, bucket);

                // Update counter
                this.directory.add(ctx, [collection, SUBSPACE_COUNTER, bucketNo], INT_PLUS_ONE);
            });
        });
    }

    remove = async (parent: Context, collection: Buffer, id: number) => {
        if (id < 0) {
            throw Error('Id could not be less than zero');
        }
        return await inTxLeaky(parent, async (ctx) => {
            return await inTxLock(ctx, 'bucket-collection-' + collection.toString('hex'), async () => {
                let bucketNo = Math.ceil(id / this.bucketSize);

                // Update bucket
                let bucket = await this.readBlock(ctx, collection, bucketNo);
                if (binarySearch(bucket, id) < 0) {
                    return;
                }
                bucket = bucket.filter((v) => v !== id);
                this.writeBlock(ctx, collection, bucketNo, bucket);

                // Update counter
                this.directory.add(ctx, [collection, SUBSPACE_COUNTER, bucketNo], INT_MINUS_ONE);
            });
        });
    }

    count = async (parent: Context, collection: Buffer, cursor: { from?: number | null, to?: number | null }) => {
        return await inTxLeaky(parent, async (ctx) => {
            return await inTxLock(ctx, 'bucket-collection-' + collection.toString('hex'), async () => {

                // Flush pending writes
                this.flushWrites(ctx, collection);

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
            });
        });
    }

    //
    // Block operations
    //

    private async readBlock(ctx: Context, collection: Buffer, index: number): Promise<number[]> {

        // Check cache
        let cache = this.getCache(ctx, collection);
        if (cache.cache[index]) {
            return cache.cache[index];
        }

        // Read from storage
        let bucket = (await this.directory.get(ctx, [collection, SUBSPACE_BUCKET, index]));
        let val: number[];
        if (bucket) {
            val = encoders.tuple.unpack(bucket) as number[];
        } else {
            val = [];
        }
        cache.cache[index] = val;
        return val;
    }

    private writeBlock(ctx: Context, collection: Buffer, index: number, values: number[]) {

        // Update cache
        let cache = this.getCache(ctx, collection);
        let wasEmpty = Object.keys(cache.writes).length === 0;
        cache.cache[index] = values;
        cache.writes[index] = values;

        if (wasEmpty) {
            getTransaction(ctx).beforeCommit((commit) => {
                this.flushWrites(commit, collection);
            });
        }
    }

    private flushWrites(ctx: Context, collection: Buffer) {
        let cache = this.getCache(ctx, collection);
        for (let index in cache.writes) {
            this.directory.set(ctx, [collection, SUBSPACE_BUCKET, parseInt(index, 10)], encoders.tuple.pack(cache.writes[index]));
        }
        cache.writes = {};
    }

    private getCache(ctx: Context, collection: Buffer) {
        let cacheKey = collection.toString('hex');
        let cache = bucketWriteCache.get(ctx, cacheKey);
        if (!cache) {
            cache = { writes: {}, cache: {} };
            bucketWriteCache.set(ctx, cacheKey, cache);
        }
        return cache;
    }
}