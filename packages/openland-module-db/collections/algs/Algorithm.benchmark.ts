// tslint:disable:no-console
import { createNamedContext } from '@openland/context';
import { Database, encoders, inTx } from '@openland/foundationdb';
import { Algorithm } from './Algorithm';
import { BucketCountingCollection } from './BucketCountingCollection';
import { BucketCountingOptimizedCollection } from './BucketCountingOptimizedCollection';
import { DirectCountingCollection } from './DirectCountingCollection';

let root = createNamedContext('test');
const COLLECTION_0 = encoders.tuple.pack([0]);
const COLLECTION_1 = encoders.tuple.pack([1]);

async function benchmarkPrepare(alg: Algorithm) {
    for (let j = 0; j < 100; j++) {
        await inTx(root, async (ctx) => {
            for (let i = 0; i < 10000; i++) {
                await alg.add(ctx, COLLECTION_0, j * 10000 + i);
            }
        });
    }

    for (let j = 0; j < 100; j++) {
        await inTx(root, async (ctx) => {
            for (let i = 0; i < 100; i++) {
                await alg.add(ctx, COLLECTION_1, j * 10000 + i * 100);
            }
        });
    }
}

async function benchmarkSimple(alg: Algorithm) {
    await inTx(root, async (ctx) => {
        return await alg.count(ctx, COLLECTION_0, { from: 15, to: 900000 });
    });
}

async function benchmarkAll(alg: Algorithm) {
    await inTx(root, async (ctx) => {
        return await alg.count(ctx, COLLECTION_0, {});
    });
}

async function benchmarkSparse(alg: Algorithm) {
    await inTx(root, async (ctx) => {
        return await alg.count(ctx, COLLECTION_1, {});
    });
}

// tslint:disable-next-line:no-floating-promises
(async () => {

    console.log('Loading database...');
    let db = await Database.openTest({ name: 'counting-collection-benchmark', layers: [] });

    for (let type of ['direct', 'bucket', 'bucket-optimized', 'bucket-optimized-large', 'bucket-optimized-xlarge'] as const) {

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
        } else if (type === 'bucket-optimized-xlarge') {
            alg = new BucketCountingOptimizedCollection(db.allKeys, 1000);
        } else {
            throw Error();
        }
        await benchmarkPrepare(alg);

        //
        // Benchmarking
        //
        console.log('Benchmarking ' + type);
        let start = Date.now();
        await benchmarkSimple(alg);
        console.log('simple:' + type + ': ' + (Date.now() - start) + 'ms');
        start = Date.now();
        await benchmarkSparse(alg);
        console.log('sparse:' + type + ': ' + (Date.now() - start) + 'ms');
        start = Date.now();
        await benchmarkAll(alg);
        console.log('all:' + type + ': ' + (Date.now() - start) + 'ms');
    }
})();