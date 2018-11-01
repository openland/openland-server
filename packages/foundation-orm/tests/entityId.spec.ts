// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { FConnection } from 'foundation-orm/FConnection';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { AllEntities } from './testSchema';
import { NoOpBus } from './NoOpBus';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { unpackFID } from 'foundation-orm/FID';

describe('Entity with ID', () => {
    // Database Init
    let db: fdb.Database<NativeValue, any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_ids']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        testEntities = new AllEntities(new FConnection(db, NoOpBus));
    });

    it('should persist correctry', async () => {
        let existing = await testEntities.IdEntity.create(unpackFID('0101'), { data: 'hello' });
        let e2 = (await testEntities.IdEntity.findById(unpackFID('0101')))!;
        expect(existing.id).toBe(e2.id);
    });
});