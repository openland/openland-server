// tslint:disable:no-floating-promises
import { SafeContext } from './SafeContext';
import sequelize from 'sequelize';
import { FConnection } from 'foundation-orm/FConnection';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';

describe('SafeContext', () => {
    // afterAll(() => {
    //     exportContextDebug();
    // });
    it('should work', async () => {
        let context = new SafeContext<string>();
        await context.withContext('hello', async () => {
            expect(context.value).toEqual('hello');
            await null;
            expect(context.value).toEqual('hello');
            await (async () => {
                expect(context.value).toEqual('hello');
                await null;
                expect(context.value).toEqual('hello');
            })();
        });
        expect(context.value).toEqual(undefined);
    });
    it('should work with foundationdb', async () => {
        let db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_context']));
        await db.clearRange(FKeyEncoding.encodeKey([]));

        let context = new SafeContext<string>();
        await context.withContext('hello', async () => {
            expect(context.value).toEqual('hello');
            await db.set(FKeyEncoding.encodeKey(['test-key']), 'hello');
            await db.doTransaction(async (tn) => {
                expect(context.value).toEqual('hello');
                await db.get(FKeyEncoding.encodeKey(['test-key']));
                expect(context.value).toEqual('hello');
                await db.set(FKeyEncoding.encodeKey(['test-key']), 'hello2');
                expect(context.value).toEqual('hello');
            });
            expect(context.value).toEqual('hello');
        });
        expect(context.value).toEqual(undefined);
    });

    it('should work with sequelize', async () => {
        let db = new sequelize('openland_tests', process.env.DATABASE_POSTGRESQL_USERNAME || 'test', process.env.DATABASE_POSTGRESQL_PASSWORD || 'test', {
            host: 'localhost',
            port: 5432,
            dialect: 'postgres',
            benchmark: process.env.DATABASE_LOGGING !== 'false',
            logging: process.env.DATABASE_LOGGING !== 'false',
            pool: {
                max: 20,
                acquire: 10000
            }
        });
        let context = new SafeContext<string>();
        await context.withContext('hello', async () => {
            expect(context.value).toEqual('hello');
            await db.transaction(async () => {
                expect(context.value).toEqual('hello');
                await null;
                expect(context.value).toEqual('hello');
            });
            expect(context.value).toEqual('hello');
        });
    });
});