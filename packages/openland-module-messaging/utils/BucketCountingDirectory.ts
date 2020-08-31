import { encoders, getTransaction, inTx, Subspace, TupleItem } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Metrics } from '../../openland-module-monitoring/Metrics';

export class BucketCountingDirectory {
    private bucketSize: number;
    private directory: Subspace<TupleItem[], TupleItem[]>;

    constructor(directory: Subspace<Buffer, Buffer>, bucketSize: number) {
        this.directory = directory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.tuple);

        this.bucketSize = bucketSize;
    }

    add = async (parent: Context, collectionPrefix: number[], id: number) => {
        return await inTx(parent, async (ctx) => {
            if (id <= 0) {
                throw Error('Id could not be less than zero');
            }

            let bucketNo = Math.ceil(id / this.bucketSize);
            let bucket = (await this.directory.get(ctx, [...collectionPrefix, bucketNo])) || [];

            if (bucket.includes(id)) {
                return;
            }

            bucket.push(id);
            this.directory.set(ctx, [...collectionPrefix, bucketNo], bucket);
        });
    }

    remove = async (parent: Context, collectionPrefix: number[], id: number) => {
        return await inTx(parent, async (ctx) => {
            if (id <= 0) {
                throw Error('Id could not be less than zero');
            }

            let bucketNo = Math.ceil(id / this.bucketSize);
            let bucket = (await this.directory.get(ctx, [...collectionPrefix, bucketNo])) || [];

            if (!bucket.includes(id)) {
                return;
            }

            this.directory.set(ctx, [...collectionPrefix, bucketNo], bucket.filter(v => v !== id));
        });
    }

    count = async (parent: Context, collectionPrefix: number[], cursor: { from?: number | null, to?: number | null }) => {
        return await inTx(parent, async (ctx) => {
            let start = Date.now();
            // Resolve offsets
            let fromBuffer: Buffer;
            let toBuffer: Buffer;
            if (cursor.from !== null && cursor.from !== undefined) {
                let bucketNo = Math.ceil(cursor.from / this.bucketSize);
                fromBuffer = Buffer.concat([this.directory.prefix, encoders.tuple.pack([...collectionPrefix, bucketNo])]);
            } else {
                fromBuffer = Buffer.concat([this.directory.prefix, encoders.tuple.pack(collectionPrefix)]);
            }
            if (cursor.to !== null && cursor.to !== undefined) {
                let bucketNo = Math.ceil(cursor.to / this.bucketSize);
                toBuffer = Buffer.concat([this.directory.prefix, encoders.tuple.pack([...collectionPrefix, bucketNo + 1])]);
            } else {
                collectionPrefix[collectionPrefix.length - 1]++;
                toBuffer = Buffer.concat([this.directory.prefix, encoders.tuple.pack(collectionPrefix)]);
            }

            // Read all keys
            let tx = getTransaction(ctx).rawTransaction(this.directory.db);
            let batches = await tx.getRangeAll(fromBuffer, toBuffer);
            let all = batches.map(v => encoders.tuple.unpack(v[1])).flat();

            Metrics.CountingDirectoryBatchesRead.report(batches.length);
            if (cursor.from !== null && cursor.from !== undefined) {
                all = all.filter(id => id! >= cursor.from!);
            }
            if (cursor.to !== null && cursor.to !== undefined) {
                all = all.filter(id => id! <= cursor.to!);
            }
            Metrics.CountingDirectoryCountTime.report(Date.now() - start);
            return all.length;
        });
    }
}