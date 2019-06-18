import { EntityLayer } from './../EntityLayer';
// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { AllEntities, AllEntitiesDirect } from './testSchema';
import { FConnection } from '../FConnection';
import { inTx } from '../inTx';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { NoOpBus } from './NoOpBus';
import { createNamedContext } from '@openland/context';

describe('FEntity Versioned', () => {

    // Database Init
    let db: fdb.Database<NativeValue, any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_versioned']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        let connection = new FConnection(db, NoOpBus);
        let layer = new EntityLayer(connection, NoOpBus);
        testEntities = new AllEntitiesDirect(layer);
        await connection.ready(createNamedContext('test'));
        await layer.ready(createNamedContext('test'));
    });

    it('should create with version number eq to one', async () => {
        let parent = createNamedContext('test');
        await inTx(parent, async (ctx) => { await testEntities.VersionedEntity.create(ctx, 0, { data: 'hello world' }); });
        let res = (await testEntities.VersionedEntity.findById(parent, 0))!;
        expect(res.versionCode).toEqual(1);
    });

    it('should update version number by one', async () => {
        let parent = createNamedContext('test');
        await inTx(parent, async (ctx) => { await testEntities.VersionedEntity.create(ctx, 1, { data: 'hello world' }); });
        await inTx(parent, async (ctx) => {
            let ex = (await testEntities.VersionedEntity.findById(ctx, 1))!;
            ex.data = 'bye world';
        });
        let res = (await testEntities.VersionedEntity.findById(parent, 1))!;
        expect(res.versionCode).toEqual(2);
    });

    it('should create with version number eq to one', async () => {
        let parent = createNamedContext('test');
        await inTx(parent, async (ctx) => { await testEntities.VersionedEntity.create(ctx, 2, { data: 'hello world' }); });
        let res = (await testEntities.VersionedEntity.findById(parent, 2))!;
        expect(res.versionCode).toEqual(1);
    });
});