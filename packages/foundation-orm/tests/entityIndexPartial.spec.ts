import { EntityLayer } from './../EntityLayer';
// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { FConnection } from 'foundation-orm/FConnection';
import { AllEntities, AllEntitiesDirect } from './testSchema';
import { inTx } from 'foundation-orm/inTx';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { NoOpBus } from './NoOpBus';
import { createNamedContext } from '@openland/context';

describe('Partial Index', () => {

    // Database Init
    let db: fdb.Database<NativeValue, any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_partial']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        let connection = new FConnection(db, NoOpBus);
        let layer = new EntityLayer(connection, NoOpBus);
        testEntities = new AllEntitiesDirect(layer);
        await connection.ready(createNamedContext('test'));
        await layer.ready(createNamedContext('test'));
    });

    it('should create indexes if condition true', async () => {
        let root = createNamedContext('test');
        let res1 = await inTx(root, async (ctx) => { return await testEntities.IndexedPartialEntity.create(ctx, 0, { data1: 'hello', data2: 'world', data3: '' }); });
        expect(res1.data1).toEqual('hello');
        expect(res1.data2).toEqual('world');
        let res2 = (await testEntities.IndexedPartialEntity.findFromDefault(root, 'hello', 'world', 0))!;
        expect(res2).not.toBeNull();
        expect(res2.id).toEqual(0);
        expect(res2.rawId[0]).toEqual(0);
        expect(res2.data1).toEqual('hello');
        expect(res2.data2).toEqual('world');

        let res3 = (await inTx(root, async (ctx) => { return testEntities.IndexedPartialEntity.findFromDefault(ctx, 'hello', 'world', 0); }))!;
        expect(res3).not.toBeNull();
        expect(res3.id).toEqual(0);
        expect(res3.rawId[0]).toEqual(0);
        expect(res3.data1).toEqual('hello');
        expect(res3.data2).toEqual('world');
    });

    it('should not create indexes if condition false', async () => {
        let root = createNamedContext('test');
        let res1 = await inTx(root, async (ctx) => { return await testEntities.IndexedPartialEntity.create(ctx, 1, { data1: 'hello2', data2: 'world', data3: '' }); });
        expect(res1.data1).toEqual('hello2');
        expect(res1.data2).toEqual('world');
        let res2 = (await testEntities.IndexedPartialEntity.findFromDefault(root, 'hello2', 'world', 1))!;
        expect(res2).toBeNull();

        let res3 = (await inTx(root, async (ctx) => { return testEntities.IndexedPartialEntity.findFromDefault(ctx, 'hello2', 'world', 0); }))!;
        expect(res3).toBeNull();
    });

    it('should create indexes if condition was changed from false to true', async () => {
        let root = createNamedContext('test');
        let res1 = await inTx(root, async (ctx) => { return await testEntities.IndexedPartialEntity.create(ctx, 3, { data1: 'hello2', data2: 'world', data3: '' }); });
        expect(res1.data1).toEqual('hello2');
        expect(res1.data2).toEqual('world');

        let res3 = (await inTx(root, async (ctx) => {
            let res = (await testEntities.IndexedPartialEntity.findById(ctx, 3))!;
            res.data1 = 'hello';
            return res;
        }))!;
        expect(res3).not.toBeNull();
        expect(res3.id).toEqual(3);
        expect(res3.rawId[0]).toEqual(3);
        expect(res3.data1).toEqual('hello');
        expect(res3.data2).toEqual('world');

        expect(await testEntities.IndexedPartialEntity.findFromDefault(root, 'hello2', 'world', 3)).toBeNull();

        let res4 = (await testEntities.IndexedPartialEntity.findFromDefault(root, 'hello', 'world', 3))!;
        expect(res4).not.toBeNull();
        expect(res4.id).toEqual(3);
        expect(res4.rawId[0]).toEqual(3);
        expect(res4.data1).toEqual('hello');
        expect(res4.data2).toEqual('world');

        let res5 = (await inTx(root, async (ctx) => { return testEntities.IndexedPartialEntity.findFromDefault(ctx, 'hello', 'world', 3); }))!;
        expect(res5).not.toBeNull();
        expect(res5.id).toEqual(3);
        expect(res5.rawId[0]).toEqual(3);
        expect(res5.data1).toEqual('hello');
        expect(res5.data2).toEqual('world');
    });

    it('should delete indexes if condition was changed from true to false', async () => {
        let root = createNamedContext('test');
        let res1 = await inTx(root, async (ctx) => { return await testEntities.IndexedPartialEntity.create(ctx, 4, { data1: 'hello', data2: 'world', data3: '' }); });
        expect(res1.data1).toEqual('hello');
        expect(res1.data2).toEqual('world');

        let res3 = (await inTx(root, async (ctx) => {
            let res = (await testEntities.IndexedPartialEntity.findById(ctx, 4))!;
            res.data1 = 'hello2';
            return res;
        }))!;
        expect(res3).not.toBeNull();
        expect(res3.id).toEqual(4);
        expect(res3.rawId[0]).toEqual(4);
        expect(res3.data1).toEqual('hello2');
        expect(res3.data2).toEqual('world');

        expect(await testEntities.IndexedPartialEntity.findFromDefault(root, 'hello', 'world', 4)).toBeNull();
        expect(await testEntities.IndexedPartialEntity.findFromDefault(root, 'hello2', 'world', 4)).toBeNull();
    });
});