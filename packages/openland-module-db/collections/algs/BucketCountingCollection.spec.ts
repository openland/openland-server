import { createNamedContext } from '@openland/context';
import { inTx, Database, encoders } from '@openland/foundationdb';
import { BucketCountingCollection } from './BucketCountingCollection';

describe('BucketCountingCollection', () => {
    it('should count elements', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'counting-collection-bucket', layers: [] });
        let counters = new BucketCountingCollection(db.allKeys, 1);
        const COLLECTION_0 = encoders.tuple.pack([0]);
        const COLLECTION_1 = encoders.tuple.pack([1]);
        const COLLECTION_2 = encoders.tuple.pack([2]);

        // Write
        await inTx(root, async (ctx) => {
            await counters.add(ctx, COLLECTION_0, 4);
            await counters.add(ctx, COLLECTION_0, 341);
            await counters.add(ctx, COLLECTION_0, 1);
            await counters.add(ctx, COLLECTION_0, 3);

            await counters.add(ctx, COLLECTION_1, 2);
            await counters.add(ctx, COLLECTION_1, 3);
            await counters.add(ctx, COLLECTION_1, 4);
            await counters.add(ctx, COLLECTION_1, 5);

            await counters.add(ctx, COLLECTION_2, 10);
            await counters.add(ctx, COLLECTION_2, 12);
            await counters.add(ctx, COLLECTION_2, 14);
            await counters.add(ctx, COLLECTION_2, 9);
        });

        let counted = await inTx(root, async (ctx) => {
            return await counters.count(ctx, COLLECTION_1, { from: 2, to: 5 });
        });
        expect(counted).toBe(4);

        counted = await inTx(root, async (ctx) => {
            return await counters.count(ctx, COLLECTION_1, { to: 5 });
        });
        expect(counted).toBe(4);

        counted = await inTx(root, async (ctx) => {
            return await counters.count(ctx, COLLECTION_1, { from: 2, });
        });
        expect(counted).toBe(4);

        counted = await inTx(root, async (ctx) => {
            return await counters.count(ctx, COLLECTION_1, { from: 3 });
        });
        expect(counted).toBe(3);
    });
});