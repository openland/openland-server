import { createNamedContext } from '@openland/context';
import { testEnvironmentEnd, testEnvironmentStart } from 'openland-modules/testEnvironment';
import { inTx } from '@openland/foundationdb';
import { ScalableAllocator } from './ScalableAllocator';

const parent = createNamedContext('test');

describe('ScalableAllocator', () => {

    it('should find workers', async () => {
        const allocator = new ScalableAllocator();
        expect(await inTx(parent, async (ctx) => {
            return await allocator.findWorker(ctx, [], 100, 10);
        })).toBeNull();

        expect(await inTx(parent, async (ctx) => {
            return await allocator.findWorker(ctx, ['worker-1', 'worker-2'], 100, 10);
        })).toBe('worker-1');

        expect(await inTx(parent, async (ctx) => {
            return await allocator.findWorker(ctx, ['worker-1', 'worker-2'], 100, 1000);
        })).toBeNull();
    });

    it('should allocate correctly', async () => {
        const allocator = new ScalableAllocator();
        expect(await inTx(parent, async (ctx) => {
            allocator.allocWorker(ctx, 'worker-1', 100);
            allocator.allocWorker(ctx, 'worker-2', 100);
            return await allocator.findWorker(ctx, ['worker-1', 'worker-2'], 1000, 100);
        })).toBe('worker-1');
        expect(await inTx(parent, async (ctx) => {
            allocator.allocWorker(ctx, 'worker-1', 100);
            return await allocator.findWorker(ctx, ['worker-1', 'worker-2'], 1000, 100);
        })).toBe('worker-2');
        expect(await inTx(parent, async (ctx) => {
            allocator.deallocWorker(ctx, 'worker-1', 100);
            return await allocator.findWorker(ctx, ['worker-1', 'worker-2'], 1000, 100);
        })).toBe('worker-1');
        expect(await inTx(parent, async (ctx) => {
            allocator.allocWorker(ctx, 'worker-1', 2000);
            allocator.allocWorker(ctx, 'worker-2', 800);
            return await allocator.findWorker(ctx, ['worker-1', 'worker-2'], 1000, 100);
        })).toBe('worker-2');
        expect(await inTx(parent, async (ctx) => {
            allocator.allocWorker(ctx, 'worker-2', 100);
            return await allocator.findWorker(ctx, ['worker-1', 'worker-2'], 1000, 100);
        })).toBeNull();
    });

    beforeAll(async () => {
        await testEnvironmentStart('calls-scalable-allocator');
    });
    afterAll(async () => {
        await testEnvironmentEnd();
    });
});