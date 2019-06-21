// tslint:disable:no-floating-promises
import { EntityLayer } from 'foundation-orm/EntityLayer';
import { AllEntities, AllEntitiesDirect } from './testSchema';
import { NoOpBus } from './NoOpBus';
import { createNamedContext } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { openTestDatabase } from 'openland-server/foundationdb';

describe('FEntity', () => {

    // Database Init
    let testEntities: AllEntities;
    let rootCtx = createNamedContext('test');
    beforeAll(async () => {
        let db = await openTestDatabase();
        let layer = new EntityLayer(db, NoOpBus);
        testEntities = await AllEntitiesDirect.create(layer);
        await layer.ready(rootCtx);
    });

    it('should be able to create items', async () => {
        let rootctx = rootCtx;
        let res = await inTx(rootctx, async (ctx) => {
            return await testEntities.SimpleEntity.create(ctx, 14, { data: 'hello world' });
        });
        expect(res.data).toEqual('hello world');
        expect(res.id).toEqual(14);
        expect(res.versionCode).toEqual(0);
        expect(res.createdAt).toEqual(0);
        expect(res.updatedAt).toEqual(0);
    });
    it('should crash on create if exists', async () => {
        let rootctx = rootCtx;
        // First create
        await inTx(rootctx, async (ctx) => {
            await testEntities.SimpleEntity.create(ctx, 12, { data: 'hello world' });
        });
        // Double create
        let res = inTx(rootctx, async (ctx) => {
            return await testEntities.SimpleEntity.create(ctx, 12, { data: 'hello world' });
        });
        expect(res).rejects.toThrowError('Object with id SimpleEntity.12 already exists');
    });

    it('should update values', async () => {
        let parent = rootCtx;
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

    it('should read nullable falsy fields correctly', async () => {
        let parent = rootCtx;
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

    it('should update values when read outside transaction', async () => {
        let parent = rootCtx;
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

    it('should crash when trying to change read-only instance', async () => {
        let parent = rootCtx;
        await inTx(parent, async (ctx) => { await testEntities.SimpleEntity.create(ctx, 4, { data: 'hello world' }); });
        let res = (await testEntities.SimpleEntity.findById(parent, 4))!;
        expect(() => { res.data = 'bye world'; }).toThrowError();
    });

    it('should crash when trying to change instance after transaction completed', async () => {
        let parent = rootCtx;
        await inTx(parent, async (ctx) => { await testEntities.SimpleEntity.create(ctx, 5, { data: 'hello world' }); });
        let res = await inTx(parent, async (ctx) => { return (await testEntities.SimpleEntity.findById(ctx, 5))!; });
        expect(() => { res.data = 'bye world'; }).toThrowError();
    });

    it('should be able to read values from entity even when transaction is completed', async () => {
        let parent = rootCtx;
        await inTx(parent, async (ctx) => { await testEntities.SimpleEntity.create(ctx, 7, { data: 'hello world' }); });
        let res = await inTx(parent, async (ctx) => { return (await testEntities.SimpleEntity.findById(ctx, 7))!; });
        expect(res.data).toEqual('hello world');
    });

    it('double flush should work', async () => {
        let parent = rootCtx;
        await inTx(parent, async (ctx) => {
            let res = await testEntities.SimpleEntity.create(ctx, 10, { data: 'hello world' });
            await res.flush(ctx);
            await res.flush(ctx);
        });
    });

    it('should save valid json field', async () => {
        let rctx = rootCtx;
        let res = await inTx(rctx, async (ctx) => {
            return await testEntities.JsonTest.create(ctx, 1, { test: { type: 'link', length: 0, offset: 0, url: '_' } });
        });

        expect(res.test.type).toEqual('link');
        expect(res.test.length).toEqual(0);
        expect(res.test.offset).toEqual(0);
        expect(res.test.url).toEqual('_');
    });

    it('should not save invalid json field', async () => {
        let rctx = rootCtx;
        let res = inTx(rctx, async (ctx) => {
            return await testEntities.JsonTest.create(ctx, 2, { test: { type: 'link', length: true, offset: 0, url: '_' } as any });
        });
        expect(res).rejects.toThrowError('Field root.length must be number, got: true');
    });

    it('should throw on second creation', async () => {
        let rootctx = rootCtx;
        await inTx(rootctx, async (ctx) => {
            let ex = testEntities.SimpleEntity.create(ctx, 140, { data: 'hello world1' });
            let ex2 = testEntities.SimpleEntity.create(ctx, 140, { data: 'hello world2' });
            await expect(ex).resolves.not.toBeUndefined();
            await expect(ex).resolves.not.toBeNull();
            await expect(ex2).rejects.toThrowError();
        });
    });

    it('should return same references for same key (async)', async () => {
        let rootctx = rootCtx;
        await inTx(rootctx, async (ctx) => {
            let r1 = testEntities.SimpleEntity.create(ctx, 141, { data: 'hello world1' });
            let r2 = testEntities.SimpleEntity.findById(ctx, 141);
            expect(await r1).toBe(await r2);
        });

        await inTx(rootctx, async (ctx) => {
            let r1 = testEntities.SimpleEntity.findById(ctx, 141);
            let r2 = testEntities.SimpleEntity.findById(ctx, 141);
            expect(await r1).toBe(await r2);
        });
    });

    it('should return same references for same key', async () => {
        let rootctx = rootCtx;
        await inTx(rootctx, async (ctx) => {
            let r1 = await testEntities.SimpleEntity.create(ctx, 142, { data: 'hello world1' });
            let r2 = await testEntities.SimpleEntity.findById(ctx, 142);
            expect(r1).toBe(r2);
        });

        await inTx(rootctx, async (ctx) => {
            let r1 = await testEntities.SimpleEntity.findById(ctx, 141);
            let r2 = await testEntities.SimpleEntity.findById(ctx, 141);
            expect(r1).toBe(r2);
        });
    });
});