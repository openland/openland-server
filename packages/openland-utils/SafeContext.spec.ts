// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { SafeContext, exportContextDebug } from './SafeContext';

describe('SafeContext', () => {
    afterAll(() => {
        exportContextDebug();
    });
    it('should work', async () => {
        let context = new SafeContext<string>();
        await context.withContext('hello', async () => {
            expect(context.value).toEqual('hello');
            await null;
            expect(context.value).toEqual('hello');
            await (async () => {
                expect(context.value).toEqual('hello');
                console.log('test output');
                expect(context.value).toEqual('hello');
            })();
        });
        expect(context.value).toEqual(undefined);
    });
    it('should work with foundationdb', async () => {
        fdb.setAPIVersion(510);
        let db = fdb.openSync()
            .at('_tests_context')
            .withKeyEncoding(fdb.encoders.tuple)
            .withValueEncoding(fdb.encoders.json);
        await db.clearRange([]);

        let context = new SafeContext<string>();
        await context.withContext('hello', async () => {
            expect(context.value).toEqual('hello');
            await db.set(['test-key'], 'hello');
            await db.doTransaction(async (tn) => {
                expect(context.value).toEqual('hello');
                await db.get(['test-key']);
                expect(context.value).toEqual('hello');
                await db.set(['test-key'], 'hello2');
                expect(context.value).toEqual('hello');
            });
            expect(context.value).toEqual('hello');
        });
        expect(context.value).toEqual(undefined);
    });
});