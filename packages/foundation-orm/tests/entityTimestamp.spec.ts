import { EntityLayer } from './../EntityLayer';
// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { AllEntities, AllEntitiesDirect } from './testSchema';
import { FConnection } from '../FConnection';
import { inTx } from '../inTx';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { NoOpBus } from './NoOpBus';
import { createNamedContext } from '@openland/context';

describe('FEntity Timestamped', () => {

    // Database Init
    let db: fdb.Database<NativeValue, any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_timestamp']));
        let connection = new FConnection(db);
        await db.clearRange(FKeyEncoding.encodeKey([]));
        let layer = new EntityLayer(connection, NoOpBus);
        testEntities = new AllEntitiesDirect(layer);
        await layer.ready(createNamedContext('test'));
    });

    it('should create with correct timestamps', async () => {
        let parent = createNamedContext('test');
        let start = Date.now();
        let res1 = await inTx(parent, async (ctx) => { return await testEntities.TimestampedEntity.create(ctx, 0, { data: 'hello world' }); });
        let end = Date.now();
        expect(res1.createdAt).toEqual(res1.updatedAt);
        expect(res1.createdAt).toBeGreaterThanOrEqual(start);
        expect(res1.createdAt).toBeLessThanOrEqual(end);
        expect(res1.updatedAt).toBeGreaterThanOrEqual(start);
        expect(res1.updatedAt).toBeLessThanOrEqual(end);
        let res = (await testEntities.TimestampedEntity.findById(parent, 0))!;
        expect(res.createdAt).toEqual(res.updatedAt);
        expect(res.createdAt).toBeGreaterThanOrEqual(start);
        expect(res.updatedAt).toBeLessThanOrEqual(end);
        expect(res.updatedAt).toBeGreaterThanOrEqual(start);
        expect(res.updatedAt).toBeLessThanOrEqual(end);
    });

    it('should update with correct timestamps', async () => {
        let parent = createNamedContext('test');
        await inTx(parent, async (ctx) => { await testEntities.TimestampedEntity.create(ctx, 1, { data: 'hello world' }); });
        let start = Date.now();
        await inTx(parent, async (ctx) => {
            let ex = (await testEntities.TimestampedEntity.findById(ctx, 1))!;
            ex.data = 'bye world';
        });
        let end = Date.now();
        let res = (await testEntities.TimestampedEntity.findById(parent, 1))!;
        expect(res.createdAt).toBeLessThanOrEqual(res.updatedAt);
        expect(res.updatedAt).toBeGreaterThanOrEqual(start);
        expect(res.updatedAt).toBeLessThanOrEqual(end);
    });
});