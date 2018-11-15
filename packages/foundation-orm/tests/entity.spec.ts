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

describe('FEntity', () => {

    // Database Init
    let db: fdb.Database<NativeValue, any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_1']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        testEntities = new AllEntitiesDirect(new FConnection(db, NoOpBus));
    });

    it('should be able to create items', async () => {
        let rootctx = createEmptyContext();
        await withLogDisabled(async () => {
            let res = await inTx(rootctx, async (ctx) => {
                return await testEntities.SimpleEntity.create(ctx, 14, { data: 'hello world' });
            });
            expect(res.data).toEqual('hello world');
            expect(res.id).toEqual(14);
            expect(res.versionCode).toEqual(0);
            expect(res.createdAt).toEqual(0);
            expect(res.updatedAt).toEqual(0);
        });
    });
    it('should crash on create if exists', async () => {
        let rootctx = createEmptyContext();
        await withLogDisabled(async () => {
            // First create
            await inTx(rootctx, async (ctx) => {
                await testEntities.SimpleEntity.create(ctx, 12, { data: 'hello world' });
            });
            // Double create
            let res = inTx(rootctx, async (ctx) => {
                return await testEntities.SimpleEntity.create(ctx, 12, { data: 'hello world' });
            });
            expect(res).rejects.toThrowError('Object with id entity.simpleEntity.12 already exists');
        });
    });

    it('should update values', async () => {
        let parent = createEmptyContext();
        await withLogDisabled(async () => {
            await inTx(parent, async (ctx) => {
                await testEntities.SimpleEntity.create(ctx, 3, { data: 'hello world' });
            });
            await inTx(parent, async (ctx) => {
                let entity = await testEntities.SimpleEntity.findById(ctx, 3);
                entity!.data = 'bye world';
            });
            let res = await inTx(parent, async (ctx) => {
                return await testEntities.SimpleEntity.findById(ctx, 3);
            });
            expect(res!.data).toEqual('bye world');
        });
    });

    it('should read nullable falsy fields correctly', async () => {
        let parent = createEmptyContext();
        await withLogDisabled(async () => {
            await inTx(parent, async (ctx) => {
                await testEntities.NullableEntity.create(ctx, 0, { flag: true });
                await testEntities.NullableEntity.create(ctx, 1, { flag: false });
                await testEntities.NullableEntity.create(ctx, 2, { flag: null });
            });

            let { res0, res1, res2 } = await inTx(parent, async (ctx) => {
                return {
                    res0: await testEntities.NullableEntity.findById(ctx, 0),
                    res1: await testEntities.NullableEntity.findById(ctx, 1),
                    res2: await testEntities.NullableEntity.findById(ctx, 2)
                };
            });
            expect(res0!.flag).toEqual(true);
            expect(res1!.flag).toEqual(false);
            expect(res2!.flag).toEqual(null);
        });
    });

    it('should update values when read outside transaction', async () => {
        let parent = createEmptyContext();
        await withLogDisabled(async () => {
            await inTx(parent, async (ctx) => {
                await testEntities.SimpleEntity.create(ctx, 6, { data: 'hello world' });
            });
            await inTx(parent, async (ctx) => {
                let entity = await testEntities.SimpleEntity.findById(ctx, 6);
                entity!.data = 'bye world';
            });
            let res = await testEntities.SimpleEntity.findById(parent, 6);
            expect(res!.data).toEqual('bye world');
        });
    });

    it('should crash when trying to change read-only instance', async () => {
        let parent = createEmptyContext();
        await withLogDisabled(async () => {
            await inTx(parent, async (ctx) => { await testEntities.SimpleEntity.create(ctx, 4, { data: 'hello world' }); });
            let res = (await testEntities.SimpleEntity.findById(parent, 4))!;
            expect(() => { res.data = 'bye world'; }).toThrowError();
        });
    });

    it('should crash when trying to change instance after transaction completed', async () => {
        let parent = createEmptyContext();
        await withLogDisabled(async () => {
            await inTx(parent, async (ctx) => { await testEntities.SimpleEntity.create(ctx, 5, { data: 'hello world' }); });
            let res = await inTx(parent, async (ctx) => { return (await testEntities.SimpleEntity.findById(ctx, 5))!; });
            expect(() => { res.data = 'bye world'; }).toThrowError();
        });
    });

    it('should be able to read values from entity even when transaction is completed', async () => {
        let parent = createEmptyContext();
        await withLogDisabled(async () => {
            await inTx(parent, async (ctx) => { await testEntities.SimpleEntity.create(ctx, 7, { data: 'hello world' }); });
            let res = await inTx(parent, async (ctx) => { return (await testEntities.SimpleEntity.findById(ctx, 7))!; });
            expect(res.data).toEqual('hello world');
        });
    });

    it('double flush should work', async () => {
        let parent = createEmptyContext();
        await withLogDisabled(async () => {
            await inTx(parent, async (ctx) => {
                let res = await testEntities.SimpleEntity.create(ctx, 10, { data: 'hello world' });
                await res.flush();
                await res.flush();
            });
        });
    });
});