import { EntityLayer } from './../EntityLayer';
// tslint:disable:no-floating-promises
// tslint:disable:no-console
import * as fdb from 'foundationdb';
import { AllEntities, AllEntitiesDirect } from './testSchema';
import { FConnection } from '../FConnection';
import { inTx } from '../inTx';
import { delay } from '../../openland-utils/timer';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { NoOpBus } from './NoOpBus';
import { createNamedContext } from '@openland/context';

describe('FWatch', () => {

    // Database Init
    let db: fdb.Database<NativeValue, any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_watch']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        let connection = new FConnection(db);
        let layer = new EntityLayer(connection, NoOpBus);
        testEntities = new AllEntitiesDirect(layer);
        await connection.ready(createNamedContext('test'));
        await layer.ready(createNamedContext('test'));
    });

    it('should call callback on entity change', async () => {
        let parent = createNamedContext('test');
        await inTx(parent, async (ctx) => {
            await testEntities.SimpleEntity.create(ctx, 100, { data: 'test' });
        });

        let func = jest.fn();
        (async () => {
            while (true) {
                let w = await inTx(parent, async (ctx) => testEntities.SimpleEntity.watch(ctx, 100));
                await w.promise;
                func();
            }
        })();
        await inTx(parent, async (ctx) => {
            let v = await testEntities.SimpleEntity.findById(ctx, 100);
            v!.data = 'test2';
        });

        await delay(1000);

        expect(func.mock.calls.length).toBe(1);
    });

    it('should call callback on entity change multiply times', async () => {
        let parent = createNamedContext('test');
        await inTx(parent, async (ctx) => {
            await testEntities.SimpleEntity.create(ctx, 101, { data: 'test' });
        });

        let func = jest.fn();

        (async () => {
            while (true) {
                let w = await inTx(parent, async (ctx) => testEntities.SimpleEntity.watch(ctx, 101));
                await w.promise;
                func();
            }
        })();

        for (let i = 0; i < 4; i++) {
            await inTx(parent, async (ctx) => {
                let v = await testEntities.SimpleEntity.findById(ctx, 101);
                v!.data = i.toString(16);
            });
            await delay(200);
        }

        await delay(500);

        expect(func).toHaveBeenCalledTimes(4);
    });

    // it('should not call callback if subscription was canceled', async () => {
    //     let parent = createNamedContext('test');
    //     await inTx(parent, async (ctx) => {
    //         await testEntities.SimpleEntity.create(ctx, 103, { data: 'test' });
    //     });

    //     let func = jest.fn();

    //     let sub = testEntities.SimpleEntity.watch(parent, 103, () => func());

    //     for (let i = 0; i < 4; i++) {
    //         await inTx(parent, async (ctx) => {
    //             let v = await testEntities.SimpleEntity.findById(ctx, 103);
    //             v!.data = i.toString(16);
    //         });
    //         if (i === 1) {
    //             sub.cancel();
    //         }
    //         await delay(200);
    //     }

    //     await delay(1000);
    //     expect(func).toHaveBeenCalledTimes(1);
    // });
});