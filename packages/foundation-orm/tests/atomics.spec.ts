// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { FConnection } from 'foundation-orm/FConnection';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { AllEntitiesDirect, AllEntities } from './testSchema';
import { NoOpBus } from './NoOpBus';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { createEmptyContext } from 'openland-utils/Context';
import { inTx } from 'foundation-orm/inTx';

describe('atomics', () => {
    let db: fdb.Database<NativeValue, any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_atomics']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        testEntities = new AllEntitiesDirect(new FConnection(db, NoOpBus));
    });

    it('should set and get', async () => {
        let rootctx = createEmptyContext();
        await inTx(rootctx, async (ctx) => {
            let atomic = await testEntities.SampleAtomic.findById(ctx, 'some');
            await atomic.set(ctx, 1339);
        });
        let res = await (await testEntities.SampleAtomic.findById(rootctx, 'some')).get(rootctx);
        expect(res).toEqual(1339);

        let res2 = await inTx(rootctx, async (ctx) => {
            let atomic = await testEntities.SampleAtomic.findById(ctx, 'some');
            return await atomic.get(ctx);
        });
        expect(res2).toEqual(1339);
    });

    it('should increment and decrement', async () => {
        let rootctx = createEmptyContext();
        await inTx(rootctx, async (ctx) => {
            let atomic = await testEntities.SampleAtomic.findById(ctx, 'some-1');
            await atomic.set(ctx, 1339);
        });

        await inTx(rootctx, async (ctx) => {
            let atomic = await testEntities.SampleAtomic.findById(ctx, 'some-1');
            atomic.increment(ctx);
        });

        let res = await (await testEntities.SampleAtomic.findById(rootctx, 'some-1')).get(rootctx);
        expect(res).toEqual(1340);

        await inTx(rootctx, async (ctx) => {
            let atomic = await testEntities.SampleAtomic.findById(ctx, 'some-1');
            atomic.increment(ctx);
            atomic.increment(ctx);
            atomic.increment(ctx);
            atomic.increment(ctx);
            atomic.increment(ctx);
            atomic.increment(ctx);
            atomic.increment(ctx);
            atomic.increment(ctx);
            atomic.increment(ctx);
            atomic.increment(ctx);
        });

        let res2 = await (await testEntities.SampleAtomic.findById(rootctx, 'some-1')).get(rootctx);
        expect(res2).toEqual(1350);

        // await inTx(rootctx, async (ctx) => {
        //     let atomic = await testEntities.SampleAtomic.findById(ctx, 'some-1');
        //     atomic.add(ctx, -1);
        // });

        // let res3 = await (await testEntities.SampleAtomic.findById(rootctx, 'some-1')).get(rootctx);
        // expect(res3).toEqual(1349);
    });
});