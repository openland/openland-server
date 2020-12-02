import { createNamedContext } from '@openland/context';
import { Database, encoders, inTx } from '@openland/foundationdb';
import { DirectCountingCollection } from './DirectCountingCollection';

describe('DirectCountingCollection', () => {
    it('should count elements', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'counting-collection-direct', layers: [] });
        let counters = new DirectCountingCollection(db.allKeys);
        const COLLECTION_0 = encoders.tuple.pack([0]);
        const COLLECTION_1 = encoders.tuple.pack([1]);
        const COLLECTION_2 = encoders.tuple.pack([2]);

        // Write
        await inTx(root, async (ctx) => {
            counters.add(ctx, COLLECTION_0, 4);
            counters.add(ctx, COLLECTION_0, 341);
            counters.add(ctx, COLLECTION_0, 1);
            counters.add(ctx, COLLECTION_0, 3);

            counters.add(ctx, COLLECTION_1, 2);
            counters.add(ctx, COLLECTION_1, 3);
            counters.add(ctx, COLLECTION_1, 4);
            counters.add(ctx, COLLECTION_1, 5);

            counters.add(ctx, COLLECTION_2, 10);
            counters.add(ctx, COLLECTION_2, 12);
            counters.add(ctx, COLLECTION_2, 14);
            counters.add(ctx, COLLECTION_2, 9);
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