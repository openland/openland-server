import 'reflect-metadata';
import { createNamedContext } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';
import { testEnvironmentStart } from 'openland-modules/testEnvironment';
import { BucketCountingDirectory } from './BucketCountingDirectory';

describe('BucketCountingDirectory', () => {
    beforeAll(async () => {
        await testEnvironmentStart('batched-counting-directory');
    });
    it('should count elements', async () => {
        let root = createNamedContext('test');
        let directory = await inTx(root, async (ctx) => {
            return await Store.storage.db.directories.createOrOpen(ctx, ['test']);
        });
        let counters = new BucketCountingDirectory(directory, 1);

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