import { SafeContext } from './SafeContext';

describe('SafeContext', () => {
    it('should work', async () => {
        let context = new SafeContext<string>('test');
        await context.runAsync(async () => {
            context.value = 'hello';
            expect(context.value).toEqual('hello');
            await null;
            expect(context.value).toEqual('hello');
            await (async () => {
                expect(context.value).toEqual('hello');
                console.log('test output');
                expect(context.value).toEqual('hello');
            })();
            context.value = undefined;
            expect(context.value).toEqual(undefined);
        });
    });
});