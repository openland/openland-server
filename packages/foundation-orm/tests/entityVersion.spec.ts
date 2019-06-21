// tslint:disable:no-floating-promises
import { inTx } from '@openland/foundationdb';
import { EntityLayer } from './../EntityLayer';
import { AllEntities, AllEntitiesDirect } from './testSchema';
import { NoOpBus } from './NoOpBus';
import { createNamedContext } from '@openland/context';
import { openTestDatabase } from 'openland-server/foundationdb';

describe('FEntity Versioned', () => {

    // Database Init
    let testEntities: AllEntities;
    beforeAll(async () => {
        let db = await openTestDatabase();
        let layer = new EntityLayer(db, NoOpBus, 'app');
        testEntities = await AllEntitiesDirect.create(layer);
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