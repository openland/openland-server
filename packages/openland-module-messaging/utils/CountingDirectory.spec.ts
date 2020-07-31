import 'reflect-metadata';
import { CountingDirectory } from './CountingDirectory';
import { createNamedContext } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';
import { testEnvironmentStart } from 'openland-modules/testEnvironment';

describe('CountingDirectory', () => {
    beforeAll(async () => {
        await testEnvironmentStart('counting-directory');
    });
    it('should count elements', async () => {
        let root = createNamedContext('test');
        let directory = await inTx(root, async (ctx) => {
            return await Store.storage.db.directories.createOrOpen(ctx, ['test']);
        });
        let counters = new CountingDirectory(directory);

        // Write
        await inTx(root, async (ctx) => {
            counters.add(ctx, 0, 4);
            counters.add(ctx, 0, 341);
            counters.add(ctx, 0, 1);
            counters.add(ctx, 0, 3);

            counters.add(ctx, 1, 2);
            counters.add(ctx, 1, 3);
            counters.add(ctx, 1, 4);
            counters.add(ctx, 1, 5);

            counters.add(ctx, 2, 10);
            counters.add(ctx, 2, 12);
            counters.add(ctx, 2, 14);
            counters.add(ctx, 2, 9);
        });

        let counted = await inTx(root, async (ctx) => {
            return await counters.count(ctx, 1, { from: 2, to: 5 });
        });
        expect(counted).toBe(4);

        counted = await inTx(root, async (ctx) => {
            return await counters.count(ctx, 1, { to: 5 });
        });
        expect(counted).toBe(4);

        counted = await inTx(root, async (ctx) => {
            return await counters.count(ctx, 1, { from: 2, });
        });
        expect(counted).toBe(4);

        counted = await inTx(root, async (ctx) => {
            return await counters.count(ctx, 1, { from: 3 });
        });
        expect(counted).toBe(3);
    });
});