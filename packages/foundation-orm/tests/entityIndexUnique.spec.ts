// tslint:disable:no-floating-promises
import { inTx } from '@openland/foundationdb';
import { AllEntities, AllEntitiesDirect } from './testSchema';
import { createNamedContext } from '@openland/context';
import { EntityLayer } from './../EntityLayer';
import { openTestDatabase } from 'openland-server/foundationdb';

describe('FEntity with unique index', () => {

    // Database Init
    let testEntities: AllEntities;
    beforeAll(async () => {
        let db = await openTestDatabase();
        let layer = new EntityLayer(db, 'app');
        testEntities = await AllEntitiesDirect.create(layer);
    });

    it('should create indexes', async () => {
        let parent = createNamedContext('test');
        let res1 = await inTx(parent, async (ctx) => { return await testEntities.IndexedEntity.create(ctx, 0, { data1: 'hello', data2: 'world', data3: '' }); });
        expect(res1.data1).toEqual('hello');
        expect(res1.data2).toEqual('world');
        let res2 = (await testEntities.IndexedEntity.findFromDefault(parent, 'hello', 'world', 0))!;
        expect(res2.rawId[0]).toEqual(0);
        expect(res2.data1).toEqual('hello');
        expect(res2.data2).toEqual('world');
    });

    it('should update indexes', async () => {
        let parent = createNamedContext('test');
        await inTx(parent, async (ctx) => { return await testEntities.IndexedEntity.create(ctx, 1, { data1: 'hello', data2: 'world', data3: '' }); });
        await inTx(parent, async (ctx) => {
            let res = (await testEntities.IndexedEntity.findFromDefault(ctx, 'hello', 'world', 1))!;
            res.data1 = 'bye';
        });
        let res2 = (await testEntities.IndexedEntity.findFromDefault(parent, 'hello', 'world', 1));
        expect(res2).toBeNull();

        let res3 = (await testEntities.IndexedEntity.findFromDefault(parent, 'bye', 'world', 1))!;
        expect(res3.id).toEqual(1);
        expect(res3.data1).toEqual('bye');
        expect(res3.data2).toEqual('world');
    });

    it('should update content', async () => {
        let parent = createNamedContext('test');
        await inTx(parent, async (ctx) => { return await testEntities.IndexedEntity.create(ctx, 3, { data1: 'hello', data2: 'world', data3: '' }); });
        await inTx(parent, async (ctx) => {
            let res = (await testEntities.IndexedEntity.findFromDefault(ctx, 'hello', 'world', 3))!;
            res.data3 = 'yo';
        });
        expect((await testEntities.IndexedEntity.findFromDefault(parent, 'hello', 'world', 3))!.data3).toBe('yo');
    });
});