import { createNamedContext } from '@openland/context';
import { inTx, Database } from '@openland/foundationdb';
import { BucketCountingCollection } from './BucketCountingCollection';

describe('BucketCountingCollection', () => {
    it('should count elements', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'counting-collection-bucket', layers: [] });
        let counters = new BucketCountingCollection(db.allKeys, 1);

        // Write
        await inTx(root, async (ctx) => {
            await counters.add(ctx, [0], 4);
            await counters.add(ctx, [0], 341);
            await counters.add(ctx, [0], 1);
            await counters.add(ctx, [0], 3);

            await counters.add(ctx, [1], 2);
            await counters.add(ctx, [1], 3);
            await counters.add(ctx, [1], 4);
            await counters.add(ctx, [1], 5);

            await counters.add(ctx, [2], 10);
            await counters.add(ctx, [2], 12);
            await counters.add(ctx, [2], 14);
            await counters.add(ctx, [2], 9);
        });

        let counted = await inTx(root, async (ctx) => {
            return await counters.count(ctx, [1], { from: 2, to: 5 });
        });
        expect(counted).toBe(4);

        counted = await inTx(root, async (ctx) => {
            return await counters.count(ctx, [1], { to: 5 });
        });
        expect(counted).toBe(4);

        counted = await inTx(root, async (ctx) => {
            return await counters.count(ctx, [1], { from: 2, });
        });
        expect(counted).toBe(4);

        counted = await inTx(root, async (ctx) => {
            return await counters.count(ctx, [1], { from: 3 });
        });
        expect(counted).toBe(3);
    });
});