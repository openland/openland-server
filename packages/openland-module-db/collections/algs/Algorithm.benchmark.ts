// tslint:disable:no-console
import { createNamedContext } from '@openland/context';
import { Database, encoders, inTx } from '@openland/foundationdb';
import { Algorithm } from './Algorithm';
import { BucketCountingCollection } from './BucketCountingCollection';
import { BucketCountingOptimizedCollection } from './BucketCountingOptimizedCollection';
import { DirectCountingCollection } from './DirectCountingCollection';

let root = createNamedContext('test');
const COLLECTION_0 = encoders.tuple.pack([0]);

async function benchmarkPrepare(alg: Algorithm) {
    for (let j = 0; j < 100; j++) {
        await inTx(root, async (ctx) => {
            for (let i = 0; i < 10000; i++) {
                await alg.add(ctx, COLLECTION_0, j * 10000 + i);
            }
        });
    }
}

async function benchmark(alg: Algorithm) {
    await inTx(root, async (ctx) => {
        return await alg.count(ctx, COLLECTION_0, { from: 15, to: 900000 });
    });
}

// tslint:disable-next-line:no-floating-promises
(async () => {

    console.log('Loading database...');
    let db = await Database.openTest({ name: 'counting-collection-benchmark', layers: [] });

    for (let type of ['direct', 'bucket', 'bucket-optimized', 'bucket-optimized-large'] as const) {

        //
        // Prepare
        //

        console.log('Prepare ' + type);
        await inTx(root, async (ctx) => {
            db.allKeys.clearPrefixed(ctx, Buffer.from([]));
        });
        let alg: Algorithm;
        if (type === 'direct') {
            alg = new DirectCountingCollection(db.allKeys);
        } else if (type === 'bucket') {
            alg = new BucketCountingCollection(db.allKeys, 10);
        } else if (type === 'bucket-optimized') {
            alg = new BucketCountingOptimizedCollection(db.allKeys, 10);
        } else if (type === 'bucket-optimized-large') {
            alg = new BucketCountingOptimizedCollection(db.allKeys, 100);
        } else {
            throw Error();
        }
        await benchmarkPrepare(alg);

        //
        // Benchmarking
        //
        console.log('Benchmarking ' + type);
        let start = Date.now();
        await benchmark(alg);
        console.log(type + ': ' + (Date.now() - start) + 'ms');
    }
})();