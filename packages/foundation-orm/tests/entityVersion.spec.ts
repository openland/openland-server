// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { AllEntities } from './testSchema';
import { FConnection } from '../FConnection';
import { inTx } from '../inTx';

describe('FEntity Versioned', () => {
    // Database Init
    let db: fdb.Database<fdb.TupleItem[], any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(['_tests_2']);
        await db.clearRange([]);
        testEntities = new AllEntities(new FConnection(db));
    });

    it('should create with version number eq to one', async () => {
        await inTx(async () => { await testEntities.VersionedEntity.create(0, { data: 'hello world' }); });
        let res = (await testEntities.VersionedEntity.findById(0))!;
        expect(res.versionCode).toEqual(1);
    });

    it('should update version number by one', async () => {
        await inTx(async () => { await testEntities.VersionedEntity.create(1, { data: 'hello world' }); });
        await inTx(async () => {
            let ex = (await testEntities.VersionedEntity.findById(1))!;
            ex.data = 'bye world';
        });
        let res = (await testEntities.VersionedEntity.findById(1))!;
        expect(res.versionCode).toEqual(2);
    });

    it('should create with version number eq to one', async () => {
        await inTx(async () => { await testEntities.VersionedEntity.create(2, { data: 'hello world' }); });
        let res = (await testEntities.VersionedEntity.findById(2))!;
        expect(res.versionCode).toEqual(1);
    });
});