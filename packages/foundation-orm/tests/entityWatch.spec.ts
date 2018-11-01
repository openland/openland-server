import * as fdb from 'foundationdb';
import { AllEntities } from './testSchema';
import { FConnection } from '../FConnection';
import { inTx } from '../inTx';
import { delay } from '../../openland-server/utils/timer';
import { withLogDisabled } from 'openland-log/withLogDisabled';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { NoOpBus } from './NoOpBus';

describe('FWatch', () => {

    // Database Init
    let db: fdb.Database<NativeValue, any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_watch']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        testEntities = new AllEntities(new FConnection(db, NoOpBus));
    });

    it('should call callback on entity change', async () => {
        await withLogDisabled(async () => {
            await inTx(async () => {
                await testEntities.SimpleEntity.create(1, { data: 'test' });
            });

            let func = jest.fn();

            testEntities.SimpleEntity.watch(1, () => func());

            await inTx(async () => {
                let v = await testEntities.SimpleEntity.findById(1);
                v!.data = 'test2';
            });

            await delay(1000);

            expect(func.mock.calls.length).toBe(1);
        });
    });

    it('should call callback on entity change multiply times', async () => {
        await withLogDisabled(async () => {
            await inTx(async () => {
                await testEntities.SimpleEntity.create(2, { data: 'test' });
            });

            let func = jest.fn();

            testEntities.SimpleEntity.watch(2, () => func());

            for (let i = 0; i < 4; i++) {
                await inTx(async () => {
                    let v = await testEntities.SimpleEntity.findById(2);
                    v!.data = Math.random().toString(16);
                });
                await delay(100);
            }

            await delay(500);

            expect(func).toHaveBeenCalledTimes(4);
        });
    });

    it('should not call callback if subscription was canceled', async () => {
        await withLogDisabled(async () => {
            await inTx(async () => {
                await testEntities.SimpleEntity.create(3, { data: 'test' });
            });

            let func = jest.fn();

            let sub = testEntities.SimpleEntity.watch(3, () => func());

            for (let i = 0; i < 4; i++) {
                await inTx(async () => {
                    let v = await testEntities.SimpleEntity.findById(3);
                    v!.data = Math.random().toString(16);
                });
                if (i === 1) {
                    sub.cancel();
                }
                await delay(100);
            }

            await delay(1000);
            expect(func).toHaveBeenCalledTimes(1);
        });
    });
});