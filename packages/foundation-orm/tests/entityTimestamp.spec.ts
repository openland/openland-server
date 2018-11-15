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

describe('FEntity Timestamped', () => {

    // Database Init
    let db: fdb.Database<NativeValue, any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_timestamp']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        testEntities = new AllEntitiesDirect(new FConnection(db, NoOpBus));
    });

    it('should create with correct timestamps', async () => {
        let ctx = createEmptyContext();
        await withLogDisabled(async () => {
            let start = Date.now();
            let res1 = await inTx(async () => { return await testEntities.TimestampedEntity.create(ctx, 0, { data: 'hello world' }); });
            let end = Date.now();
            expect(res1.createdAt).toEqual(res1.updatedAt);
            expect(res1.createdAt).toBeGreaterThanOrEqual(start);
            expect(res1.createdAt).toBeLessThanOrEqual(end);
            expect(res1.updatedAt).toBeGreaterThanOrEqual(start);
            expect(res1.updatedAt).toBeLessThanOrEqual(end);
            let res = (await testEntities.TimestampedEntity.findById(ctx, 0))!;
            expect(res.createdAt).toEqual(res.updatedAt);
            expect(res.createdAt).toBeGreaterThanOrEqual(start);
            expect(res.updatedAt).toBeLessThanOrEqual(end);
            expect(res.updatedAt).toBeGreaterThanOrEqual(start);
            expect(res.updatedAt).toBeLessThanOrEqual(end);
        });
    });

    it('should update with correct timestamps', async () => {
        let ctx = createEmptyContext();
        await withLogDisabled(async () => {
            await inTx(async () => { await testEntities.TimestampedEntity.create(ctx, 1, { data: 'hello world' }); });
            let start = Date.now();
            await inTx(async () => {
                let ex = (await testEntities.TimestampedEntity.findById(ctx, 1))!;
                ex.data = 'bye world';
            });
            let end = Date.now();
            let res = (await testEntities.TimestampedEntity.findById(ctx, 1))!;
            expect(res.createdAt).toBeLessThanOrEqual(res.updatedAt);
            expect(res.updatedAt).toBeGreaterThanOrEqual(start);
            expect(res.updatedAt).toBeLessThanOrEqual(end);
        });
    });
});