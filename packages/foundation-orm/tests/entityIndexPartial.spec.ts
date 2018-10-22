// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { FConnection } from 'foundation-orm/FConnection';
import { AllEntities } from './testSchema';
import { inTx } from 'foundation-orm/inTx';

describe('Partial Index', () => {

    // Database Init
    let db: fdb.Database<fdb.TupleItem[], any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(['_tests_partial']);
        await db.clearRange([]);
        testEntities = new AllEntities(new FConnection(db));
    });

    it('should create indexes if condition true', async () => {
        let res1 = await inTx(async () => { return await testEntities.IndexedPartialEntity.create(0, { data1: 'hello', data2: 'world' }); });
        expect(res1.data1).toEqual('hello');
        expect(res1.data2).toEqual('world');
        let res2 = (await testEntities.IndexedPartialEntity.findFromDefault('hello', 'world', 0))!;
        expect(res2).not.toBeNull();
        expect(res2.id).toEqual(0);
        expect(res2.rawId[0]).toEqual(0);
        expect(res2.data1).toEqual('hello');
        expect(res2.data2).toEqual('world');

        let res3 = (await inTx(async () => { return testEntities.IndexedPartialEntity.findFromDefault('hello', 'world', 0); }))!;
        expect(res3).not.toBeNull();
        expect(res3.id).toEqual(0);
        expect(res3.rawId[0]).toEqual(0);
        expect(res3.data1).toEqual('hello');
        expect(res3.data2).toEqual('world');
    });

    it('should not create indexes if condition false', async () => {
        let res1 = await inTx(async () => { return await testEntities.IndexedPartialEntity.create(1, { data1: 'hello2', data2: 'world' }); });
        expect(res1.data1).toEqual('hello2');
        expect(res1.data2).toEqual('world');
        let res2 = (await testEntities.IndexedPartialEntity.findFromDefault('hello2', 'world', 1))!;
        expect(res2).toBeNull();

        let res3 = (await inTx(async () => { return testEntities.IndexedPartialEntity.findFromDefault('hello2', 'world', 0); }))!;
        expect(res3).toBeNull();
    });

    it('should create indexes if condition was changed from false to true', async () => {
        let res1 = await inTx(async () => { return await testEntities.IndexedPartialEntity.create(3, { data1: 'hello2', data2: 'world' }); });
        expect(res1.data1).toEqual('hello2');
        expect(res1.data2).toEqual('world');

        let res3 = (await inTx(async () => {
            let res = (await testEntities.IndexedPartialEntity.findById(3))!;
            res.data1 = 'hello';
            return res;
        }))!;
        expect(res3).not.toBeNull();
        expect(res3.id).toEqual(3);
        expect(res3.rawId[0]).toEqual(3);
        expect(res3.data1).toEqual('hello');
        expect(res3.data2).toEqual('world');

        expect(await testEntities.IndexedPartialEntity.findFromDefault('hello2', 'world', 3)).toBeNull();

        let res4 = (await testEntities.IndexedPartialEntity.findFromDefault('hello', 'world', 3))!;
        expect(res4).not.toBeNull();
        expect(res4.id).toEqual(3);
        expect(res4.rawId[0]).toEqual(3);
        expect(res4.data1).toEqual('hello');
        expect(res4.data2).toEqual('world');

        let res5 = (await inTx(async () => { return testEntities.IndexedPartialEntity.findFromDefault('hello', 'world', 3); }))!;
        expect(res5).not.toBeNull();
        expect(res5.id).toEqual(3);
        expect(res5.rawId[0]).toEqual(3);
        expect(res5.data1).toEqual('hello');
        expect(res5.data2).toEqual('world');
    });

    it('should delete indexes if condition was changed from true to false', async () => {
        let res1 = await inTx(async () => { return await testEntities.IndexedPartialEntity.create(4, { data1: 'hello', data2: 'world' }); });
        expect(res1.data1).toEqual('hello');
        expect(res1.data2).toEqual('world');

        let res3 = (await inTx(async () => {
            let res = (await testEntities.IndexedPartialEntity.findById(4))!;
            res.data1 = 'hello2';
            return res;
        }))!;
        expect(res3).not.toBeNull();
        expect(res3.id).toEqual(4);
        expect(res3.rawId[0]).toEqual(4);
        expect(res3.data1).toEqual('hello2');
        expect(res3.data2).toEqual('world');

        expect(await testEntities.IndexedPartialEntity.findFromDefault('hello', 'world', 4)).toBeNull();
        expect(await testEntities.IndexedPartialEntity.findFromDefault('hello2', 'world', 4)).toBeNull();
    });
});