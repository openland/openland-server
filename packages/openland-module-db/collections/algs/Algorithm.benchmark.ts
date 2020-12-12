// tslint:disable:no-console
import { createNamedContext } from '@openland/context';
import { Database, encoders, inTx } from '@openland/foundationdb';
import { Algorithm } from './Algorithm';
import { BTreeCountingCollection } from './BTreeCountingCollection';
import { BucketCountingCollection } from './BucketCountingCollection';
import { BucketCountingOptimizedCollection } from './BucketCountingOptimizedCollection';
import { DirectCountingCollection } from './DirectCountingCollection';
import { generateReport } from './utils/generateReport';

let root = createNamedContext('test');
const types = ['direct', 'bucket', 'bucket-optimized', 'bucket-optimized-large', 'bucket-optimized-xlarge', 'b-tree'] as const;
const COLLECTION_0 = encoders.tuple.pack([0]);
const COLLECTION_1 = encoders.tuple.pack([1]);

let benchrmarks: { data: { x: number, y: number }[], name: string }[] = [];
function reportBenchmark(name: string, data: { x: number, y: number }[]) {
    benchrmarks.push({ name, data });
    generateReport(__dirname + '/Algorithm.report.html', benchrmarks);
}

async function benchmarkPrepare(alg: Algorithm, type: typeof types[number]) {
    let metrics: { x: number, y: number }[] = [];
    for (let j = 0; j < 1000; j++) {
        let start = Date.now();
        await inTx(root, async (ctx) => {
            for (let i = 0; i < 1000; i++) {
                await alg.add(ctx, COLLECTION_0, j * 1000 + i);
            }
        });
        metrics.push({ x: j, y: (Date.now() - start) });
        console.log('Iteration ' + j + ' completed in ' + (Date.now() - start) + ' ms');
    }
    reportBenchmark(type + '-prepare', metrics);

    for (let j = 0; j < 10; j++) {
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

    //
    // Benchmark buckets
    //

    // let metrics: { x: number, y: number }[] = [];
    // let metrics2: { x: number, y: number }[] = [];
    // for (let i = 1000; i < 25000; i += 50) {
    //     console.log('Bucket ' + i);
    //     await inTx(root, async (ctx) => {
    //         db.allKeys.clearPrefixed(ctx, Buffer.from([]));
    //     });
    //     let start = Date.now();
    //     let count = 0;
    //     for (let j = 0; j < 100000; j += i) {
    //         count++;
    //         await inTx(root, async (ctx) => {
    //             let items: number[] = [];
    //             for (let k = 0; k < i; k++) {
    //                 items.push(k + j);
    //             }
    //             db.allKeys.set(ctx, encoders.tuple.pack([j]), encoders.tuple.pack(items));
    //         });
    //     }
    //     metrics.push({ x: i, y: Date.now() - start });
    //     metrics2.push({ x: i, y: count });
    // }
    // reportBenchmark('buckets', metrics);
    // reportBenchmark('buckets-write', metrics2);

    for (let type of ['direct', 'bucket', 'bucket-optimized', 'bucket-optimized-large', 'bucket-optimized-xlarge', 'b-tree'] as const) {

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
        } else if (type === 'b-tree') {
            alg = new BTreeCountingCollection(db.allKeys, 1000);
        } else {
            throw Error();
        }
        let start = Date.now();
        await benchmarkPrepare(alg, type);
        console.log('Prepared in ' + (Date.now() - start) + ' ms');

        //
        // Benchmarking
        //
        console.log('Benchmarking ' + type);
        start = Date.now();
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