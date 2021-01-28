import { createNamedContext } from '@openland/context';
import { Database, inTx } from '@openland/foundationdb';
import { RecentCollection } from './RecentCollection';

describe('RecentCollection', () => {
    it('should add and remove from recents', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'recent-collection', layers: [] });
        let collection = new RecentCollection(db.allKeys);

        await inTx(root, async (ctx) => {
            await collection.add(ctx, [0], { key: 1, date: 1000 });
            await collection.add(ctx, [0], { key: 2, date: 1001 });
            await collection.add(ctx, [0], { key: 5, date: 1005 });
            await collection.add(ctx, [0], { key: 3, date: 1002 });
            await collection.add(ctx, [0], { key: 4, date: 1003 });
        });

        await inTx(root, async (ctx) => {
            expect(await collection.range(ctx, [0], 10)).toMatchObject([
                { key: 1, date: 1000 },
                { key: 2, date: 1001 },
                { key: 3, date: 1002 },
                { key: 4, date: 1003 },
                { key: 5, date: 1005 }
            ]);
        });
    });
});