import * as fdb from 'foundationdb';
import { AllEntities } from './tests/testSchema';
import { FConnection } from './FConnection';
import { inTx } from './inTx';

describe('FEntity', () => {

    // Database Init
    let db: fdb.Database<fdb.TupleItem[], any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        fdb.setAPIVersion(510);
        db = fdb.openSync()
            .at('_tests')
            .withKeyEncoding(fdb.encoders.tuple)
            .withValueEncoding(fdb.encoders.json);
        await db.clearRange([]);
        testEntities = new AllEntities(new FConnection(db));
    });

    it('Should be able to create items', async () => {
        let res = await inTx(async () => {
            return await testEntities.SimpleEntity.create(0, { data: 'hello world' });
        });
        expect(res.data).toEqual('hello world');
        expect(res.id).toEqual(0);
    });
    it('Should crash on create if exists', async () => {
        // First create
        await inTx(async () => {
            await testEntities.SimpleEntity.create(2, { data: 'hello world' });
        });
        // Double create
        let res = inTx(async () => {
            return await testEntities.SimpleEntity.create(2, { data: 'hello world' });
        });
        expect(res).rejects.toThrowError('Object already exists');
    });
    it('Should update values', async () => {
        await inTx(async () => {
            await testEntities.SimpleEntity.create(3, { data: 'hello world' });
        });
        await inTx(async () => {
            let entity = await testEntities.SimpleEntity.findById(3);
            entity!.data = 'bye world';
        });
        let res = await inTx(async () => {
            return await testEntities.SimpleEntity.findById(3);
        });
        expect(res!.data).toEqual('bye world');
    });
});