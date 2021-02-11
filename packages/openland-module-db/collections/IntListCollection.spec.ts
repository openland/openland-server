import { createNamedContext } from '@openland/context';
import { Database, inTx } from '@openland/foundationdb';
import { IntListCollection } from './IntListCollection';

describe('IntListCollection', () => {
    it('should add and remove values', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({name: 'int-list-collection', layers: []});
        let collection = new IntListCollection(db.allKeys);

        await inTx(root, async (ctx) => {
            await collection.add(ctx, [0], 1);
            await collection.add(ctx, [0], 2);
            await collection.add(ctx, [0], 3);
            await collection.add(ctx, [0], 4);
            await collection.add(ctx, [0], 5);
            await collection.add(ctx, [0], 6);
            await collection.add(ctx, [0], 7);
        });

        // cursors
        await inTx(root, async (ctx) => {
            let res = await collection.range(ctx, [0], 'value', {limit: 1});
            expect(res.items.map(i => i.value)).toMatchObject([1]);
            expect(res.haveMore).toBe(true);
            res = await collection.range(ctx, [0], 'value', {after: res.cursor});
            expect(res.items.map(i => i.value)).toMatchObject([2, 3, 4, 5, 6, 7]);

            res = await collection.range(ctx, [0], 'time', {limit: 1});
            expect(res.items.map(i => i.value)).toMatchObject([1]);
            expect(res.haveMore).toBe(true);
            res = await collection.range(ctx, [0], 'time', {after: res.cursor});
            expect(res.items.map(i => i.value)).toMatchObject([2, 3, 4, 5, 6, 7]);
        });

        await inTx(root, async (ctx) => {
            expect((await collection.range(ctx, [0], 'value')).items.map(v => v.value)).toMatchObject([1, 2, 3, 4, 5, 6, 7]);
            expect((await collection.range(ctx, [0], 'time')).items.map(v => v.value)).toMatchObject([1, 2, 3, 4, 5, 6, 7]);
            expect(await collection.count(ctx, [0])).toEqual(7);
            expect(await collection.count(ctx, [1])).toEqual(0);
        });

        await inTx(root, async (ctx) => {
            await collection.remove(ctx, [0], 1);
            await collection.remove(ctx, [0], 2);
            await collection.remove(ctx, [0], 3);
            await collection.remove(ctx, [0], 4);
        });

        await inTx(root, async (ctx) => {
            expect((await collection.range(ctx, [0], 'value')).items.map(v => v.value)).toMatchObject([5, 6, 7]);
            expect((await collection.range(ctx, [0], 'time')).items.map(v => v.value)).toMatchObject([5, 6, 7]);
            expect(await collection.count(ctx, [0])).toEqual(3);
        });
    });
});