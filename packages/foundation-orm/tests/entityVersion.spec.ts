// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { AllEntities } from './testSchema';
import { FConnection } from '../FConnection';
import { inTx } from '../inTx';
import { withLogDisabled } from 'openland-log/withLogDisabled';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { NoOpBus } from './NoOpBus';

describe('FEntity Versioned', () => {

    // Database Init
    let db: fdb.Database<NativeValue, any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_versioned']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        testEntities = new AllEntities(new FConnection(db, NoOpBus));
    });

    it('should create with version number eq to one', async () => {
        await withLogDisabled(async () => {
            await inTx(async () => { await testEntities.VersionedEntity.create(0, { data: 'hello world' }); });
            let res = (await testEntities.VersionedEntity.findById(0))!;
            expect(res.versionCode).toEqual(1);
        });
    });

    it('should update version number by one', async () => {
        await withLogDisabled(async () => {
            await inTx(async () => { await testEntities.VersionedEntity.create(1, { data: 'hello world' }); });
            await inTx(async () => {
                let ex = (await testEntities.VersionedEntity.findById(1))!;
                ex.data = 'bye world';
            });
            let res = (await testEntities.VersionedEntity.findById(1))!;
            expect(res.versionCode).toEqual(2);
        });
    });

    it('should create with version number eq to one', async () => {
        await withLogDisabled(async () => {
            await inTx(async () => { await testEntities.VersionedEntity.create(2, { data: 'hello world' }); });
            let res = (await testEntities.VersionedEntity.findById(2))!;
            expect(res.versionCode).toEqual(1);
        });
    });
});