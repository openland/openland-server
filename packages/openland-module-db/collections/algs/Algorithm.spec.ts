import { createNamedContext } from '@openland/context';
import { inTx, Database, encoders } from '@openland/foundationdb';
import { Algorithm } from './Algorithm';
import { BTreeCountingCollection } from './BTreeCountingCollection';
import { BucketCountingCollection } from './BucketCountingCollection';
import { BucketCountingOptimizedCollection } from './BucketCountingOptimizedCollection';
import { DirectCountingCollection } from './DirectCountingCollection';

function testAlgorithm(type: 'direct' | 'bucket' | 'bucket-optimized' | 'b-tree') {
    it('should count elements', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'counting-collection-' + type, layers: [] });
        let alg: Algorithm;
        if (type === 'direct') {
            alg = new DirectCountingCollection(db.allKeys);
        } else if (type === 'bucket') {
            alg = new BucketCountingCollection(db.allKeys, 10);
        } else if (type === 'bucket-optimized') {
            alg = new BucketCountingOptimizedCollection(db.allKeys, 10);
        } else if (type === 'b-tree') {
            alg = new BTreeCountingCollection(db.allKeys, 1000);
        } else {
            throw Error();
        }

        const COLLECTION_0 = encoders.tuple.pack([0]);
        const COLLECTION_1 = encoders.tuple.pack([1]);
        const COLLECTION_2 = encoders.tuple.pack([2]);

        // Write
        await inTx(root, async (ctx) => {
            await alg.add(ctx, COLLECTION_0, 4);
            await alg.add(ctx, COLLECTION_0, 341);
            await alg.add(ctx, COLLECTION_0, 1);
            await alg.add(ctx, COLLECTION_0, 3);

            await alg.add(ctx, COLLECTION_1, 2);
            await alg.add(ctx, COLLECTION_1, 3);
            await alg.add(ctx, COLLECTION_1, 4);
            await alg.add(ctx, COLLECTION_1, 5);

            await alg.add(ctx, COLLECTION_2, 10);
            await alg.add(ctx, COLLECTION_2, 12);
            await alg.add(ctx, COLLECTION_2, 14);
            await alg.add(ctx, COLLECTION_2, 9);
        });

        let counted = await inTx(root, async (ctx) => {
            return await alg.count(ctx, COLLECTION_1, {});
        });
        expect(counted).toBe(4);

        counted = await inTx(root, async (ctx) => {
            return await alg.count(ctx, COLLECTION_1, { from: 2, to: 5 });
        });
        expect(counted).toBe(4);

        counted = await inTx(root, async (ctx) => {
            return await alg.count(ctx, COLLECTION_1, { to: 5 });
        });
        expect(counted).toBe(4);

        counted = await inTx(root, async (ctx) => {
            return await alg.count(ctx, COLLECTION_1, { from: 2, });
        });
        expect(counted).toBe(4);

        counted = await inTx(root, async (ctx) => {
            return await alg.count(ctx, COLLECTION_1, { from: 3 });
        });
        expect(counted).toBe(3);
    });

    it('should fill for reasonble time', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'counting-collection-fill-' + type, layers: [] });
        let alg: Algorithm;
        if (type === 'direct') {
            alg = new DirectCountingCollection(db.allKeys);
        } else if (type === 'bucket') {
            alg = new BucketCountingCollection(db.allKeys, 10);
        } else if (type === 'bucket-optimized') {
            alg = new BucketCountingOptimizedCollection(db.allKeys, 10);
        } else if (type === 'b-tree') {
            alg = new BTreeCountingCollection(db.allKeys, 1000);
        } else {
            throw Error();
        }

        // Fill collection
        const COLLECTION_0 = encoders.tuple.pack([0]);
        await inTx(root, async (ctx) => {
            for (let i = 0; i < 1000; i++) {
                await alg.add(ctx, COLLECTION_0, i);
            }
        });
    });

    it('should count for reasonble time', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'counting-collection-count-' + type, layers: [] });
        let alg: Algorithm;
        if (type === 'direct') {
            alg = new DirectCountingCollection(db.allKeys);
        } else if (type === 'bucket') {
            alg = new BucketCountingCollection(db.allKeys, 10);
        } else if (type === 'bucket-optimized') {
            alg = new BucketCountingOptimizedCollection(db.allKeys, 10);
        } else if (type === 'b-tree') {
            alg = new BTreeCountingCollection(db.allKeys, 1000);
        } else {
            throw Error();
        }

        // Fill collection
        const COLLECTION_0 = encoders.tuple.pack([0]);
        await inTx(root, async (ctx) => {
            for (let i = 0; i < 1000; i++) {
                await alg.add(ctx, COLLECTION_0, i);
            }
        });

        // Check count
        let count = await inTx(root, async (ctx) => {
            return await alg.count(ctx, COLLECTION_0, { from: 15, to: 9000 });
        });
        expect(count).toBe(985);
    });
}

for (let type of ['direct', 'bucket', 'bucket-optimized', 'b-tree'] as const) {
    let name: string;
    if (type === 'direct') {
        name = 'DirectCountingCollection';
    } else if (type === 'bucket') {
        name = 'BucketCountingCollection';
    } else if (type === 'bucket-optimized') {
        name = 'BucketCountingOptimizedCollection';
    } else if (type === 'b-tree') {
        name = 'BTreeCountingCollection';
    } else {
        throw Error();
    }
    describe(name, () => {
        testAlgorithm(type);
    });
}

    // describe('BTreeCountingCollection', () => {
    //     testAlgorithm('b-tree');
    // });