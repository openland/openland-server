// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { AllEntities } from './testSchema';
import { FConnection } from '../FConnection';
import { inTx } from '../inTx';
import { withLogDisabled } from 'openland-log/withLogDisabled';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { NativeValue } from 'foundationdb/dist/lib/native';

describe('FEntity', () => {

    // Database Init
    let db: fdb.Database<NativeValue, any>;
    let testEntities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_1']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        testEntities = new AllEntities(new FConnection(db));
    });

    it('should be able to create items', async () => {
        await withLogDisabled(async () => {
            let res = await inTx(async () => {
                return await testEntities.SimpleEntity.create(0, { data: 'hello world' });
            });
            expect(res.data).toEqual('hello world');
            expect(res.id).toEqual(0);
            expect(res.versionCode).toEqual(0);
            expect(res.createdAt).toEqual(0);
            expect(res.updatedAt).toEqual(0);
        });
    });
    it('should crash on create if exists', async () => {
        await withLogDisabled(async () => {
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
    });

    it('should update values', async () => {
        await withLogDisabled(async () => {
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

    it('should update values when read outside transaction', async () => {
        await withLogDisabled(async () => {
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
    });

    it('should crash when trying to change read-only instance', async () => {
        await withLogDisabled(async () => {
            await inTx(async () => { await testEntities.SimpleEntity.create(4, { data: 'hello world' }); });
            let res = (await testEntities.SimpleEntity.findById(4))!;
            expect(() => { res.data = 'bye world'; }).toThrowError();
        });
    });

    it('should crash when trying to change instance after transaction completed', async () => {
        await withLogDisabled(async () => {
            await inTx(async () => { await testEntities.SimpleEntity.create(5, { data: 'hello world' }); });
            let res = await inTx(async () => { return (await testEntities.SimpleEntity.findById(5))!; });
            expect(() => { res.data = 'bye world'; }).toThrowError();
        });
    });

    it('should be able to read values from entity even when transaction is completed', async () => {
        await withLogDisabled(async () => {
            await inTx(async () => { await testEntities.SimpleEntity.create(7, { data: 'hello world' }); });
            let res = await inTx(async () => { return (await testEntities.SimpleEntity.findById(7))!; });
            expect(res.data).toEqual('hello world');
        });
    });
});