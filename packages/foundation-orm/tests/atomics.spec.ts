// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { FConnection } from 'foundation-orm/FConnection';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { AllEntitiesDirect, AllEntities } from './testSchema';
import { NoOpBus } from './NoOpBus';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { inTx } from 'foundation-orm/inTx';
import { EmptyContext } from '@openland/context';

describe('atomics', () => {
    let db: fdb.Database<NativeValue, any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_atomics']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        let connection = new FConnection(db, NoOpBus);
        testEntities = new AllEntitiesDirect(connection);
        await connection.ready(EmptyContext);
    });

    it('should set and get', async () => {
        let rootctx = EmptyContext;
        await inTx(rootctx, async (ctx) => {
            let atomic = testEntities.SampleAtomic.byId('some');
            await atomic.set(ctx, 1339);
        });
        let res = await (testEntities.SampleAtomic.byId('some')).get(rootctx);
        expect(res).toEqual(1339);

        let res2 = await inTx(rootctx, async (ctx) => {
            let atomic = testEntities.SampleAtomic.byId('some');
            return await atomic.get(ctx);
        });
        expect(res2).toEqual(1339);
    });

    it('should increment and decrement', async () => {
        let rootctx = EmptyContext;
        await inTx(rootctx, async (ctx) => {
            let atomic = testEntities.SampleAtomic.byId('some-1');
            await atomic.set(ctx, 1339);
        });

        await inTx(rootctx, async (ctx) => {
            let atomic = testEntities.SampleAtomic.byId('some-1');
            atomic.increment(ctx);
        });

        let res = await (testEntities.SampleAtomic.byId('some-1')).get(rootctx);
        expect(res).toEqual(1340);

        await inTx(rootctx, async (ctx) => {
            let atomic = testEntities.SampleAtomic.byId('some-1');
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

        let res2 = await (testEntities.SampleAtomic.byId('some-1')).get(rootctx);
        expect(res2).toEqual(1350);

        await inTx(rootctx, async (ctx) => {
            let atomic = testEntities.SampleAtomic.byId('some-1');
            atomic.add(ctx, -10);
        });

        let res3 = await (testEntities.SampleAtomic.byId('some-1')).get(rootctx);
        expect(res3).toEqual(1340);
    });

    it('should set and get booleans', async () => {
        let rootctx = EmptyContext;

        let res = await (testEntities.SampleAtomicBoolean.byId('some-1')).get(rootctx);
        expect(res).toEqual(false);

        await inTx(rootctx, async (ctx) => {
            let atomic = testEntities.SampleAtomicBoolean.byId('some-1');
            await atomic.set(ctx, true);
        });

        res = await (testEntities.SampleAtomicBoolean.byId('some-1')).get(rootctx);
        expect(res).toEqual(true);

        await inTx(rootctx, async (ctx) => {
            let atomic = testEntities.SampleAtomicBoolean.byId('some-1');
            await atomic.set(ctx, false);
        });

        res = await (testEntities.SampleAtomicBoolean.byId('some-1')).get(rootctx);
        expect(res).toEqual(false);
    });
});