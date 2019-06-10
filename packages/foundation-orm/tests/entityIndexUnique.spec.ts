// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { AllEntities, AllEntitiesDirect } from './testSchema';
import { FConnection } from '../FConnection';
import { inTx } from '../inTx';
import { withLogDisabled } from 'openland-log/withLogDisabled';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { NoOpBus } from './NoOpBus';
import { createNamedContext } from '@openland/context';

describe('FEntity with unique index', () => {

    // Database Init
    let db: fdb.Database<NativeValue, any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_unique']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        let connection = new FConnection(db, NoOpBus);
        testEntities = new AllEntitiesDirect(connection);
        await connection.ready(createNamedContext('test'));
    });

    it('should create indexes', async () => {
        let parent = createNamedContext('test');
        await withLogDisabled(async () => {
            let res1 = await inTx(parent, async (ctx) => { return await testEntities.IndexedEntity.create(ctx, 0, { data1: 'hello', data2: 'world', data3: '' }); });
            expect(res1.data1).toEqual('hello');
            expect(res1.data2).toEqual('world');
            let res2 = (await testEntities.IndexedEntity.findFromDefault(parent, 'hello', 'world', 0))!;
            expect(res2.rawId[0]).toEqual(0);
            expect(res2.data1).toEqual('hello');
            expect(res2.data2).toEqual('world');
        });
    });

    it('should update indexes', async () => {
        let parent = createNamedContext('test');
        await withLogDisabled(async () => {
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
    });

    it('should update content', async () => {
        let parent = createNamedContext('test');
        await withLogDisabled(async () => {
            await inTx(parent, async (ctx) => { return await testEntities.IndexedEntity.create(ctx, 3, { data1: 'hello', data2: 'world', data3: '' }); });
            await inTx(parent, async (ctx) => {
                let res = (await testEntities.IndexedEntity.findFromDefault(ctx, 'hello', 'world', 3))!;
                res.data3 = 'yo';
            });
            expect((await testEntities.IndexedEntity.findFromDefault(parent, 'hello', 'world', 3))!.data3).toBe('yo');
        });
    });
});