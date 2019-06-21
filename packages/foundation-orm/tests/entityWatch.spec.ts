// tslint:disable:no-floating-promises
// tslint:disable:no-console
import { inTx } from '@openland/foundationdb';
import { EntityLayer } from './../EntityLayer';
import { AllEntities, AllEntitiesDirect } from './testSchema';
import { delay } from '../../openland-utils/timer';
import { NoOpBus } from './NoOpBus';
import { createNamedContext } from '@openland/context';
import { openTestDatabase } from 'openland-server/foundationdb';

describe('FWatch', () => {

    // Database Init
    let testEntities: AllEntities;
    beforeAll(async () => {
        let db = await openTestDatabase();
        let layer = new EntityLayer(db, NoOpBus, 'app');
        testEntities = await AllEntitiesDirect.create(layer);
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