// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { AllEntities, AllEntitiesDirect } from './testSchema';
import { FConnection } from '../FConnection';
import { inTx } from '../inTx';
import { withLogDisabled } from 'openland-log/withLogDisabled';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { NoOpBus } from './NoOpBus';
import { createEmptyContext } from 'openland-utils/Context';

describe('FEntity with range index', () => {

    // Database Init
    let db: fdb.Database<NativeValue, any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_range']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        testEntities = new AllEntitiesDirect(new FConnection(db, NoOpBus));
    });

    it('should create indexes', async () => {
        let parent = createEmptyContext();
        await withLogDisabled(async () => {
            let res1 = await inTx(parent, async (ctx) => { return await testEntities.IndexedRangeEntity.create(ctx, 0, { data1: 'hello', data2: 'world', data3: '' }); });
            expect(res1.data1).toEqual('hello');
            expect(res1.data2).toEqual('world');
            let res2 = (await testEntities.IndexedRangeEntity.rangeFromDefault(parent, 'hello', 1));
            expect(res2.length).toBe(1);
            expect(res2[0].rawId[0]).toEqual(0);
            expect(res2[0].data1).toEqual('hello');
            expect(res2[0].data2).toEqual('world');

            let res3 = await inTx(parent, async (ctx) => { return testEntities.IndexedRangeEntity.rangeFromDefault(ctx, 'hello', 1); });
            expect(res3.length).toBe(1);
            expect(res3[0].rawId[0]).toEqual(0);
            expect(res3[0].data1).toEqual('hello');
            expect(res3[0].data2).toEqual('world');
        });
    });
    it('should update indexes', async () => {
        let parent = createEmptyContext();
        await withLogDisabled(async () => {
            await inTx(parent, async (ctx) => { return await testEntities.IndexedRangeEntity.create(ctx, 1, { data1: 'hello2', data2: 'world', data3: '' }); });
            await inTx(parent, async (ctx) => {
                let res = (await testEntities.IndexedRangeEntity.rangeFromDefault(ctx, 'hello2', 1))!;
                res[0].data1 = 'bye2';
            });

            let res2 = (await testEntities.IndexedRangeEntity.rangeFromDefault(parent, 'hello2', 1));
            expect(res2.length).toEqual(0);

            let res3 = (await testEntities.IndexedRangeEntity.rangeFromDefault(parent, 'bye2', 1))!;
            expect(res3.length).toBe(1);
            expect(res3[0].rawId[0]).toEqual(1);
            expect(res3[0].data1).toEqual('bye2');
            expect(res3[0].data2).toEqual('world');
        });
    });

    it('paging should work correctly', async () => {
        let parent = createEmptyContext();
        await withLogDisabled(async () => {
            await inTx(parent, async (ctx) => {
                await testEntities.IndexedRangeEntity.create(ctx, 24, { data1: 'paging4', data2: '1', data3: '' });
                await testEntities.IndexedRangeEntity.create(ctx, 25, { data1: 'paging4', data2: '2', data3: '' });
                await testEntities.IndexedRangeEntity.create(ctx, 26, { data1: 'paging4', data2: '3', data3: '' });
                await testEntities.IndexedRangeEntity.create(ctx, 27, { data1: 'paging4', data2: '4', data3: '' });
                await testEntities.IndexedRangeEntity.create(ctx, 28, { data1: 'paging4', data2: '5', data3: '' });
                await testEntities.IndexedRangeEntity.create(ctx, 29, { data1: 'paging4', data2: '6', data3: '' });
                await testEntities.IndexedRangeEntity.create(ctx, 30, { data1: 'paging4', data2: '7', data3: '' });
            });
        });

        //
        // Non cursor
        //

        let res0 = await testEntities.IndexedRangeEntity.rangeFromDefault(parent, 'paging4', 2);
        expect(res0.length).toBe(2);
        expect(res0[0].id).toBe(24);
        expect(res0[1].id).toBe(25);

        let res1 = await testEntities.IndexedRangeEntity.rangeFromDefaultAfter(parent, 'paging4', '3', 2);
        expect(res1.length).toBe(2);
        expect(res1[0].id).toBe(26);
        expect(res1[1].id).toBe(27);

        //
        // Reversed
        //

        let res2 = await testEntities.IndexedRangeEntity.rangeFromDefault(parent, 'paging4', 2, true);
        expect(res2.length).toBe(2);
        expect(res2[0].id).toBe(30);
        expect(res2[1].id).toBe(29);

        let res3 = await testEntities.IndexedRangeEntity.rangeFromDefaultAfter(parent, 'paging4', '6', 2, true);
        expect(res3.length).toBe(2);
        expect(res3[0].id).toBe(28);
        expect(res3[1].id).toBe(27);
    });

    it('paging should work correctly', async () => {
        let parent = createEmptyContext();
        await withLogDisabled(async () => {
            await inTx(parent, async (ctx) => {
                await testEntities.IndexedRangeEntity.create(ctx, 4, { data1: 'paging', data2: '1', data3: '' });
                await testEntities.IndexedRangeEntity.create(ctx, 5, { data1: 'paging', data2: '2', data3: '' });
                await testEntities.IndexedRangeEntity.create(ctx, 6, { data1: 'paging', data2: '3', data3: '' });
                await testEntities.IndexedRangeEntity.create(ctx, 7, { data1: 'paging', data2: '4', data3: '' });
                await testEntities.IndexedRangeEntity.create(ctx, 8, { data1: 'paging', data2: '5', data3: '' });
                await testEntities.IndexedRangeEntity.create(ctx, 9, { data1: 'paging', data2: '6', data3: '' });
                await testEntities.IndexedRangeEntity.create(ctx, 10, { data1: 'paging', data2: '7', data3: '' });
            });

            //
            // Non-tx pass
            //

            let res = await testEntities.IndexedRangeEntity.rangeFromDefaultWithCursor(parent, 'paging', 2);
            expect(res.cursor).not.toBeUndefined();
            expect(res.cursor).not.toBeNull();
            expect(res.items.length).toBe(2);
            expect(res.items[0].id).toBe(4);
            expect(res.items[1].id).toBe(5);
            let res2 = await testEntities.IndexedRangeEntity.rangeFromDefaultWithCursor(parent, 'paging', 2, res.cursor);
            expect(res2.cursor).not.toBeUndefined();
            expect(res2.cursor).not.toBeNull();
            expect(res2.items.length).toBe(2);
            expect(res2.items[0].id).toBe(6);
            expect(res2.items[1].id).toBe(7);
            let res3 = await testEntities.IndexedRangeEntity.rangeFromDefaultWithCursor(parent, 'paging', 2, res2.cursor);
            expect(res3.cursor).not.toBeUndefined();
            expect(res3.cursor).not.toBeNull();
            expect(res3.items.length).toBe(2);
            expect(res3.items[0].id).toBe(8);
            expect(res3.items[1].id).toBe(9);
            let res4 = await testEntities.IndexedRangeEntity.rangeFromDefaultWithCursor(parent, 'paging', 2, res3.cursor);
            expect(res4.cursor).toBeUndefined();
            expect(res4.items.length).toBe(1);
            expect(res4.items[0].id).toBe(10);

            //
            // tx pass
            //

            let res5 = await inTx(parent, async (ctx) => await testEntities.IndexedRangeEntity.rangeFromDefaultWithCursor(ctx, 'paging', 2));
            expect(res5.cursor).not.toBeUndefined();
            expect(res5.cursor).not.toBeNull();
            expect(res5.items.length).toBe(2);
            expect(res5.items[0].id).toBe(4);
            expect(res5.items[1].id).toBe(5);
            let res6 = await inTx(parent, async (ctx) => await testEntities.IndexedRangeEntity.rangeFromDefaultWithCursor(ctx, 'paging', 2, res5.cursor));
            expect(res6.cursor).not.toBeUndefined();
            expect(res6.cursor).not.toBeNull();
            expect(res6.items.length).toBe(2);
            expect(res6.items[0].id).toBe(6);
            expect(res6.items[1].id).toBe(7);
            let res7 = await inTx(parent, async (ctx) => await testEntities.IndexedRangeEntity.rangeFromDefaultWithCursor(ctx, 'paging', 2, res6.cursor));
            expect(res7.cursor).not.toBeUndefined();
            expect(res7.cursor).not.toBeNull();
            expect(res7.items.length).toBe(2);
            expect(res7.items[0].id).toBe(8);
            expect(res7.items[1].id).toBe(9);
            let res8 = await inTx(parent, async (ctx) => await testEntities.IndexedRangeEntity.rangeFromDefaultWithCursor(ctx, 'paging', 2, res7.cursor));
            expect(res8.cursor).toBeUndefined();
            expect(res8.items.length).toBe(1);
            expect(res8.items[0].id).toBe(10);
        });
    });

    it('reversed paging should work correctly', async () => {
        let parent = createEmptyContext();
        await withLogDisabled(async () => {
            await inTx(parent, async (ctx) => {
                await testEntities.IndexedRangeEntity.create(ctx, 11, { data1: 'paging2', data2: '1', data3: '' });
                await testEntities.IndexedRangeEntity.create(ctx, 12, { data1: 'paging2', data2: '2', data3: '' });
                await testEntities.IndexedRangeEntity.create(ctx, 13, { data1: 'paging2', data2: '3', data3: '' });
                await testEntities.IndexedRangeEntity.create(ctx, 14, { data1: 'paging2', data2: '4', data3: '' });
                await testEntities.IndexedRangeEntity.create(ctx, 15, { data1: 'paging2', data2: '5', data3: '' });
                await testEntities.IndexedRangeEntity.create(ctx, 16, { data1: 'paging2', data2: '6', data3: '' });
                await testEntities.IndexedRangeEntity.create(ctx, 17, { data1: 'paging2', data2: '7', data3: '' });
            });

            //
            // Non-tx pass
            //

            let res = await testEntities.IndexedRangeEntity.rangeFromDefaultWithCursor(parent, 'paging2', 2, undefined, true);
            expect(res.cursor).not.toBeUndefined();
            expect(res.cursor).not.toBeNull();
            expect(res.items.length).toBe(2);
            expect(res.items[0].id).toBe(17);
            expect(res.items[1].id).toBe(16);

            let res2 = await testEntities.IndexedRangeEntity.rangeFromDefaultWithCursor(parent, 'paging2', 2, res.cursor, true);
            expect(res2.cursor).not.toBeUndefined();
            expect(res2.cursor).not.toBeNull();
            expect(res2.items.length).toBe(2);
            expect(res2.items[0].id).toBe(15);
            expect(res2.items[1].id).toBe(14);

            let res3 = await testEntities.IndexedRangeEntity.rangeFromDefaultWithCursor(parent, 'paging2', 2, res2.cursor, true);
            expect(res3.cursor).not.toBeUndefined();
            expect(res3.cursor).not.toBeNull();
            expect(res3.items.length).toBe(2);
            expect(res3.items[0].id).toBe(13);
            expect(res3.items[1].id).toBe(12);

            let res4 = await testEntities.IndexedRangeEntity.rangeFromDefaultWithCursor(parent, 'paging2', 2, res3.cursor, true);
            expect(res4.cursor).toBeUndefined();
            expect(res4.items.length).toBe(1);
            expect(res4.items[0].id).toBe(11);

            //
            // tx pass
            //

            let res5 = await inTx(parent, async (ctx) => await testEntities.IndexedRangeEntity.rangeFromDefaultWithCursor(ctx, 'paging2', 2, undefined, true));
            expect(res5.cursor).not.toBeUndefined();
            expect(res5.cursor).not.toBeNull();
            expect(res5.items.length).toBe(2);
            expect(res5.items[0].id).toBe(17);
            expect(res5.items[1].id).toBe(16);

            let res6 = await inTx(parent, async (ctx) => await testEntities.IndexedRangeEntity.rangeFromDefaultWithCursor(ctx, 'paging2', 2, res5.cursor, true));
            expect(res6.cursor).not.toBeUndefined();
            expect(res6.cursor).not.toBeNull();
            expect(res6.items.length).toBe(2);
            expect(res6.items[0].id).toBe(15);
            expect(res6.items[1].id).toBe(14);

            let res7 = await inTx(parent, async (ctx) => await testEntities.IndexedRangeEntity.rangeFromDefaultWithCursor(ctx, 'paging2', 2, res6.cursor, true));
            expect(res7.cursor).not.toBeUndefined();
            expect(res7.cursor).not.toBeNull();
            expect(res7.items.length).toBe(2);
            expect(res7.items[0].id).toBe(13);
            expect(res7.items[1].id).toBe(12);

            let res8 = await inTx(parent, async (ctx) => await testEntities.IndexedRangeEntity.rangeFromDefaultWithCursor(ctx, 'paging2', 2, res7.cursor, true));
            expect(res8.cursor).toBeUndefined();
            expect(res8.items.length).toBe(1);
            expect(res8.items[0].id).toBe(11);
        });
        // //
        // // Reversed pass
        // //
        // let res5 = await testEntities.IndexedRangeEntity.rangeFromDefaultWithCursor('paging', 2, undefined, true);
        // expect(res5.cursor).not.toBeUndefined();
        // expect(res5.cursor).not.toBeNull();
        // expect(res5.items.length).toBe(2);
        // expect(res5.items[0].id).toBe(10);
        // expect(res5.items[1].id).toBe(9);

        // let res6 = await testEntities.IndexedRangeEntity.rangeFromDefaultWithCursor('paging', 2, res5.cursor, true);
        // expect(res6.cursor).not.toBeUndefined();
        // expect(res6.cursor).not.toBeNull();
        // expect(res6.items.length).toBe(2);
        // expect(res6.items[0].id).toBe(8);
        // expect(res6.items[1].id).toBe(7);
    });
});