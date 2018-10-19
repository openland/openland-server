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
            .at('_tests_1')
            .withKeyEncoding(fdb.encoders.tuple)
            .withValueEncoding(fdb.encoders.json);
        await db.clearRange([]);
        testEntities = new AllEntities(new FConnection(db));
    });

    it('should be able to create items', async () => {
        let res = await inTx(async () => {
            return await testEntities.SimpleEntity.create(0, { data: 'hello world' });
        });
        expect(res.data).toEqual('hello world');
        expect(res.id).toEqual(0);
        expect(res.entityVersion).toEqual(0);
        expect(res.entityCreatedAt).toEqual(0);
        expect(res.entityUpdatedAt).toEqual(0);
    });
    it('should crash on create if exists', async () => {
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
    it('should update values', async () => {
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

    it('should update values when read outside transaction', async () => {
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

    it('should crash when trying to change read-only instance', async () => {
        await inTx(async () => { await testEntities.SimpleEntity.create(4, { data: 'hello world' }); });
        let res = (await testEntities.SimpleEntity.findById(4))!;
        expect(() => { res.data = 'bye world'; }).toThrowError();
    });

    it('should crash when trying to change instance after transaction completed', async () => {
        await inTx(async () => { await testEntities.SimpleEntity.create(5, { data: 'hello world' }); });
        let res = await inTx(async () => { return (await testEntities.SimpleEntity.findById(5))!; });
        expect(() => { res.data = 'bye world'; }).toThrowError();
    });

    it('should be able to read values from entity even when transaction is completed', async () => {
        await inTx(async () => { await testEntities.SimpleEntity.create(7, { data: 'hello world' }); });
        let res = await inTx(async () => { return (await testEntities.SimpleEntity.findById(7))!; });
        expect(res.data).toEqual('hello world');
    });
});

describe('FEntity Versioned', () => {
    // Database Init
    let db: fdb.Database<fdb.TupleItem[], any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        fdb.setAPIVersion(510);
        db = fdb.openSync()
            .at('_tests_2')
            .withKeyEncoding(fdb.encoders.tuple)
            .withValueEncoding(fdb.encoders.json);
        await db.clearRange([]);
        testEntities = new AllEntities(new FConnection(db));
    });

    it('should create with version number eq to one', async () => {
        await inTx(async () => { await testEntities.VersionedEntity.create(0, { data: 'hello world' }); });
        let res = (await testEntities.VersionedEntity.findById(0))!;
        expect(res.entityVersion).toEqual(1);
    });

    it('should update version number by one', async () => {
        await inTx(async () => { await testEntities.VersionedEntity.create(1, { data: 'hello world' }); });
        await inTx(async () => {
            let ex = (await testEntities.VersionedEntity.findById(1))!;
            ex.data = 'bye world';
        });
        let res = (await testEntities.VersionedEntity.findById(1))!;
        expect(res.entityVersion).toEqual(2);
    });

    it('should create with version number eq to one', async () => {
        await inTx(async () => { await testEntities.VersionedEntity.create(2, { data: 'hello world' }); });
        let res = (await testEntities.VersionedEntity.findById(2))!;
        expect(res.entityVersion).toEqual(1);
    });
});

describe('FEntity Timestamped', () => {
    // Database Init
    let db: fdb.Database<fdb.TupleItem[], any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        fdb.setAPIVersion(510);
        db = fdb.openSync()
            .at('_tests_3')
            .withKeyEncoding(fdb.encoders.tuple)
            .withValueEncoding(fdb.encoders.json);
        await db.clearRange([]);
        testEntities = new AllEntities(new FConnection(db));
    });

    it('should create with correct timestamps', async () => {
        let start = Date.now();
        let res1 = await inTx(async () => { return await testEntities.TimestampedEntity.create(0, { data: 'hello world' }); });
        let end = Date.now();
        expect(res1.entityCreatedAt).toEqual(res1.entityUpdatedAt);
        expect(res1.entityCreatedAt).toBeGreaterThanOrEqual(start);
        expect(res1.entityCreatedAt).toBeLessThanOrEqual(end);
        expect(res1.entityUpdatedAt).toBeGreaterThanOrEqual(start);
        expect(res1.entityUpdatedAt).toBeLessThanOrEqual(end);
        let res = (await testEntities.TimestampedEntity.findById(0))!;
        expect(res.entityCreatedAt).toEqual(res.entityUpdatedAt);
        expect(res.entityCreatedAt).toBeGreaterThanOrEqual(start);
        expect(res.entityCreatedAt).toBeLessThanOrEqual(end);
        expect(res.entityUpdatedAt).toBeGreaterThanOrEqual(start);
        expect(res.entityUpdatedAt).toBeLessThanOrEqual(end);
    });

    it('should update with correct timestamps', async () => {
        await inTx(async () => { await testEntities.TimestampedEntity.create(1, { data: 'hello world' }); });
        let start = Date.now();
        await inTx(async () => {
            let ex = (await testEntities.TimestampedEntity.findById(1))!;
            ex.data = 'bye world';
        });
        let end = Date.now();
        let res = (await testEntities.TimestampedEntity.findById(1))!;
        expect(res.entityCreatedAt).toBeLessThanOrEqual(res.entityUpdatedAt);
        expect(res.entityUpdatedAt).toBeGreaterThanOrEqual(start);
        expect(res.entityUpdatedAt).toBeLessThanOrEqual(end);
    });
});