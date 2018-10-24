// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { AllEntities } from './testSchema';
import { FConnection } from '../FConnection';
import { inTx } from '../inTx';
import { withLogDisabled } from 'openland-log/withLogDisabled';

describe('FEntity with range index', () => {
    // Database Init
    let db: fdb.Database<fdb.TupleItem[], any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(['_tests_5']);
        await db.clearRange([]);
        testEntities = new AllEntities(new FConnection(db));
    });

    it('should create indexes', async () => {
        await withLogDisabled(async () => {
            let res1 = await inTx(async () => { return await testEntities.IndexedRangeEntity.create(0, { data1: 'hello', data2: 'world' }); });
            expect(res1.data1).toEqual('hello');
            expect(res1.data2).toEqual('world');
            let res2 = (await testEntities.IndexedRangeEntity.rangeFromDefault('hello', 1));
            expect(res2.length).toBe(1);
            expect(res2[0].rawId[0]).toEqual(0);
            expect(res2[0].data1).toEqual('hello');
            expect(res2[0].data2).toEqual('world');

            let res3 = await inTx(async () => { return testEntities.IndexedRangeEntity.rangeFromDefault('hello', 1); });
            expect(res3.length).toBe(1);
            expect(res3[0].rawId[0]).toEqual(0);
            expect(res3[0].data1).toEqual('hello');
            expect(res3[0].data2).toEqual('world');
        });
    });
    it('should update indexes', async () => {
        await withLogDisabled(async () => {
            await inTx(async () => { return await testEntities.IndexedRangeEntity.create(1, { data1: 'hello2', data2: 'world' }); });
            await inTx(async () => {
                let res = (await testEntities.IndexedRangeEntity.rangeFromDefault('hello2', 1))!;
                res[0].data1 = 'bye2';
            });

            let res2 = (await testEntities.IndexedRangeEntity.rangeFromDefault('hello2', 1));
            expect(res2.length).toEqual(0);

            let res3 = (await testEntities.IndexedRangeEntity.rangeFromDefault('bye2', 1))!;
            expect(res3.length).toBe(1);
            expect(res3[0].rawId[0]).toEqual(1);
            expect(res3[0].data1).toEqual('bye2');
            expect(res3[0].data2).toEqual('world');
        });
    });
});