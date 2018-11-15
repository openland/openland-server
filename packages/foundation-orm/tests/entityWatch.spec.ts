import * as fdb from 'foundationdb';
import { AllEntities, AllEntitiesDirect } from './testSchema';
import { FConnection } from '../FConnection';
import { inTx } from '../inTx';
import { delay } from '../../openland-utils/timer';
import { withLogDisabled } from 'openland-log/withLogDisabled';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { NoOpBus } from './NoOpBus';
import { FWatch } from '../FWatch';
import { createEmptyContext } from 'openland-utils/Context';

describe('FWatch', () => {

    // Database Init
    let db: fdb.Database<NativeValue, any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_watch']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        testEntities = new AllEntitiesDirect(new FConnection(db, NoOpBus));
        FWatch.POOL_TIMEOUT = 10;
    });

    it('should call callback on entity change', async () => {
        let ctx = createEmptyContext();
        await withLogDisabled(async () => {
            await inTx(async () => {
                await testEntities.SimpleEntity.create(ctx, 100, { data: 'test' });
            });

            let func = jest.fn();

            testEntities.SimpleEntity.watch(ctx, 100, () => func());

            await inTx(async () => {
                let v = await testEntities.SimpleEntity.findById(ctx, 100);
                v!.data = 'test2';
            });

            await delay(1000);

            expect(func.mock.calls.length).toBe(1);
        });
    });

    it('should call callback on entity change multiply times', async () => {
        let ctx = createEmptyContext();
        await withLogDisabled(async () => {
            await inTx(async () => {
                await testEntities.SimpleEntity.create(ctx, 101, { data: 'test' });
            });

            let func = jest.fn();

            testEntities.SimpleEntity.watch(ctx, 101, () => func());

            for (let i = 0; i < 4; i++) {
                await inTx(async () => {
                    let v = await testEntities.SimpleEntity.findById(ctx, 101);
                    v!.data = i.toString(16);
                });
                await delay(200);
            }

            await delay(500);

            expect(func).toHaveBeenCalledTimes(4);
        });
    });

    it('should not call callback if subscription was canceled', async () => {
        let ctx = createEmptyContext();
        await withLogDisabled(async () => {
            await inTx(async () => {
                await testEntities.SimpleEntity.create(ctx, 103, { data: 'test' });
            });

            let func = jest.fn();

            let sub = testEntities.SimpleEntity.watch(ctx, 103, () => func());

            for (let i = 0; i < 4; i++) {
                await inTx(async () => {
                    let v = await testEntities.SimpleEntity.findById(ctx, 103);
                    v!.data = i.toString(16);
                });
                if (i === 1) {
                    sub.cancel();
                }
                await delay(200);
            }

            await delay(1000);
            expect(func).toHaveBeenCalledTimes(1);
        });
    });
});