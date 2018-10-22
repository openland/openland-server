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
        db = FConnection.create()
            .at(['_tests_1']);
        await db.clearRange([]);
        testEntities = new AllEntities(new FConnection(db));
    });

    it('should be able to create items', async () => {
        let res = await inTx(async () => {
            return await testEntities.SimpleEntity.create(0, { data: 'hello world' });
        });
        expect(res.data).toEqual('hello world');
        expect(res.id).toEqual(0);
        expect(res.versionCode).toEqual(0);
        expect(res.createdAt).toEqual(0);
        expect(res.updatedAt).toEqual(0);
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

describe('FEntity Timestamped', () => {
    // Database Init
    let db: fdb.Database<fdb.TupleItem[], any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(['_tests_3']);
        await db.clearRange([]);
        testEntities = new AllEntities(new FConnection(db));
    });

    it('should create with correct timestamps', async () => {
        let start = Date.now();
        let res1 = await inTx(async () => { return await testEntities.TimestampedEntity.create(0, { data: 'hello world' }); });
        let end = Date.now();
        expect(res1.createdAt).toEqual(res1.updatedAt);
        expect(res1.createdAt).toBeGreaterThanOrEqual(start);
        expect(res1.createdAt).toBeLessThanOrEqual(end);
        expect(res1.updatedAt).toBeGreaterThanOrEqual(start);
        expect(res1.updatedAt).toBeLessThanOrEqual(end);
        let res = (await testEntities.TimestampedEntity.findById(0))!;
        expect(res.createdAt).toEqual(res.updatedAt);
        expect(res.createdAt).toBeGreaterThanOrEqual(start);
        expect(res.updatedAt).toBeLessThanOrEqual(end);
        expect(res.updatedAt).toBeGreaterThanOrEqual(start);
        expect(res.updatedAt).toBeLessThanOrEqual(end);
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
        expect(res.createdAt).toBeLessThanOrEqual(res.updatedAt);
        expect(res.updatedAt).toBeGreaterThanOrEqual(start);
        expect(res.updatedAt).toBeLessThanOrEqual(end);
    });
});

describe('FEntity with unique index', () => {
    // Database Init
    let db: fdb.Database<fdb.TupleItem[], any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(['_tests_4']);
        await db.clearRange([]);
        testEntities = new AllEntities(new FConnection(db));
    });

    it('should create indexes', async () => {
        let res1 = await inTx(async () => { return await testEntities.IndexedEntity.create(0, { data1: 'hello', data2: 'world' }); });
        expect(res1.data1).toEqual('hello');
        expect(res1.data2).toEqual('world');
        let res2 = (await testEntities.IndexedEntity.findFromDefault('hello', 'world', 0))!;
        expect(res2.rawId[0]).toEqual(0);
        expect(res2.data1).toEqual('hello');
        expect(res2.data2).toEqual('world');
    });

    it('should update indexes', async () => {
        await inTx(async () => { return await testEntities.IndexedEntity.create(1, { data1: 'hello', data2: 'world' }); });
        await inTx(async () => {
            let res = (await testEntities.IndexedEntity.findFromDefault('hello', 'world', 1))!;
            res.data1 = 'bye';
        });
        let res2 = (await testEntities.IndexedEntity.findFromDefault('hello', 'world', 1));
        expect(res2).toBeNull();

        let res3 = (await testEntities.IndexedEntity.findFromDefault('bye', 'world', 1))!;
        expect(res3.id).toEqual(1);
        expect(res3.data1).toEqual('bye');
        expect(res3.data2).toEqual('world');
    });
});

describe('FEntity with range index', () => {
    // Database Init
    let db: fdb.Database<fdb.TupleItem[], any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(['_tests_5']);
        await db.clearRange([]);
        testEntities = new AllEntities(new FConnection(db));
    });

    it('should create indexes', async () => {
        let res1 = await inTx(async () => { return await testEntities.IndexedRangeEntity.create(0, { data1: 'hello', data2: 'world' }); });
        expect(res1.data1).toEqual('hello');
        expect(res1.data2).toEqual('world');
        let res2 = (await testEntities.IndexedRangeEntity.rangeFromDefault('hello', 1));
        expect(res2.length).toBe(1);
        expect(res2[0].rawId[0]).toEqual(0);
        expect(res2[0].data1).toEqual('hello');
        expect(res2[0].data2).toEqual('world');

        let res3 = await inTx(async () => { return testEntities.IndexedRangeEntity.rangeFromDefault('hello', 1); });
        expect(res3.length).toBe(1);
        expect(res3[0].rawId[0]).toEqual(0);
        expect(res3[0].data1).toEqual('hello');
        expect(res3[0].data2).toEqual('world');
    });
    it('should update indexes', async () => {
        console.warn('start');
        await inTx(async () => { return await testEntities.IndexedRangeEntity.create(1, { data1: 'hello2', data2: 'world' }); });
        await inTx(async () => {
            let res = (await testEntities.IndexedRangeEntity.rangeFromDefault('hello2', 1))!;
            res[0].data1 = 'bye2';
        });
        console.warn('end');

        let res2 = (await testEntities.IndexedRangeEntity.rangeFromDefault('hello2', 1));
        expect(res2.length).toEqual(0);

        let res3 = (await testEntities.IndexedRangeEntity.rangeFromDefault('bye2', 1))!;
        expect(res3.length).toBe(1);
        expect(res3[0].rawId[0]).toEqual(1);
        expect(res3[0].data1).toEqual('bye2');
        expect(res3[0].data2).toEqual('world');
    });
});