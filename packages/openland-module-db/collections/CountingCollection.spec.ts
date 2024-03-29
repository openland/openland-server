import { createNamedContext } from '@openland/context';
import { Database, inTx } from '@openland/foundationdb';
import { CountingCollection } from './CountingCollection';

describe('CountingCollection', () => {
    it('should count correctly', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'counting-collection', layers: [] });
        let collection = new CountingCollection(db.allKeys);

        // Fill initial
        await inTx(root, async (ctx) => {
            await collection.add(ctx, ['collection-1'], 0);
            await collection.add(ctx, ['collection-1'], 1);
            await collection.add(ctx, ['collection-1'], 2);
            await collection.add(ctx, ['collection-1'], 3);
            await collection.add(ctx, ['collection-1'], -1);
            await collection.add(ctx, ['collection-1'], 4);
            await collection.remove(ctx, ['collection-1'], -1);
            await collection.remove(ctx, ['collection-1'], 4);
        });

        // Resolve count
        await inTx(root, async (ctx) => {
            expect(await collection.count(ctx, ['collection-1'], 0)).toBe(3);
            expect(await collection.count(ctx, ['collection-1'], -1)).toBe(4);
            expect(await collection.count(ctx, ['collection-1'], 2)).toBe(1);
            expect(await collection.count(ctx, ['collection-1'], 3)).toBe(0);

            expect(await collection.hasAny(ctx, ['collection-1'], 0)).toBe(true);
            expect(await collection.hasAny(ctx, ['collection-1'], -1)).toBe(true);
            expect(await collection.hasAny(ctx, ['collection-1'], 2)).toBe(true);
            expect(await collection.hasAny(ctx, ['collection-1'], 3)).toBe(false);

            expect(await collection.count(ctx, ['collection-0'], 2)).toBe(0);
        });
    });

    it('should count large collection correctly', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'counting-collection', layers: [] });
        let collection = new CountingCollection(db.allKeys);

        // Fill initial
        for (let i = 0; i < 10; i++) {
            await inTx(root, async (ctx) => {
                for (let j = 0; j < 150; j++) {
                    await collection.add(ctx, ['collection-0'], i * 150 + j);
                }
            });
        }

        await inTx(root, async (ctx) => {
            expect(await collection.count(ctx, ['collection-0'], 1499)).toBe(0);
        });
    });
});