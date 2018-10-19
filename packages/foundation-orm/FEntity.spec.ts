// tslint:disable:no-floating-promises
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

    it('Should update values when read outside transaction', async () => {
        await inTx(async () => {
            await testEntities.SimpleEntity.create(6, { data: 'hello world' });
        });
        await inTx(async () => {
            let entity = await testEntities.SimpleEntity.findById(6);
            entity!.data = 'bye world';
        });
        let res = await testEntities.SimpleEntity.findById(6);
        expect(res!.data).toEqual('bye world');
    });

    it('Should crash when trying to change read-only instance', async () => {
        await inTx(async () => { await testEntities.SimpleEntity.create(4, { data: 'hello world' }); });
        let res = (await testEntities.SimpleEntity.findById(4))!;
        expect(() => { res.data = 'bye world'; }).toThrowError();
    });

    it('Should crash when trying to change instance after transaction completed', async () => {
        await inTx(async () => { await testEntities.SimpleEntity.create(5, { data: 'hello world' }); });
        let res = await inTx(async () => { return (await testEntities.SimpleEntity.findById(5))!; });
        expect(() => { res.data = 'bye world'; }).toThrowError();
    });

    it('Should be able to read values from entity even when transaction is completed', async () => {
        await inTx(async () => { await testEntities.SimpleEntity.create(7, { data: 'hello world' }); });
        let res = await inTx(async () => { return (await testEntities.SimpleEntity.findById(7))!; });
        expect(res.data).toEqual('hello world');
    });
});