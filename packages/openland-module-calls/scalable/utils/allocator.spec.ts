import { delay } from 'openland-utils/timer';
import { allocator, AllocatorState } from './allocator';

describe('allocator', () => {
    it('should allocate resources', async () => {
        let allocatorState: AllocatorState = {
            resources: {
                'worker-1': { id: 'worker-1', used: 0, available: 1000 },
                'worker-2': { id: 'worker-2', used: 0, available: 1000 }
            },
            allocations: {}
        };

        // Allocate initial
        let res = allocator(allocatorState, { amount: 100, preferred: {} })!;
        expect(res).not.toBeNull();
        expect(res.resource.available).toBe(900);
        expect(res.resource.used).toBe(100);
        expect(res.allocation.resource).toBe('worker-1');
        expect(res.allocation.used).toBe(100);
        expect(res.allocation.available).toBe(0);
        allocatorState = { resources: { ...allocatorState.resources, [res.resource.id]: res.resource }, allocations: { ...allocatorState.allocations, [res.allocation.id]: res.allocation } };

        // Expand allocation
        res = allocator(allocatorState, { amount: 100, preferred: {} })!;
        expect(res).not.toBeNull();
        expect(res.resource.available).toBe(800);
        expect(res.resource.used).toBe(200);
        expect(res.allocation.resource).toBe('worker-1');
        expect(res.allocation.used).toBe(200);
        expect(res.allocation.available).toBe(0);
        allocatorState = { resources: { ...allocatorState.resources, [res.resource.id]: res.resource }, allocations: { ...allocatorState.allocations, [res.allocation.id]: res.allocation } };

        // Expand allocation 2
        res = allocator(allocatorState, { amount: 300, preferred: {} })!;
        expect(res).not.toBeNull();
        expect(res.resource.available).toBe(500);
        expect(res.resource.used).toBe(500);
        expect(res.allocation.resource).toBe('worker-1');
        expect(res.allocation.used).toBe(500);
        expect(res.allocation.available).toBe(0);
        allocatorState = { resources: { ...allocatorState.resources, [res.resource.id]: res.resource }, allocations: { ...allocatorState.allocations, [res.allocation.id]: res.allocation } };

        // Separate allocation
        allocatorState = { ...allocatorState, allocations: {} };
        res = allocator(allocatorState, { amount: 100, preferred: {} })!;
        expect(res).not.toBeNull();
        expect(res.resource.available).toBe(900);
        expect(res.resource.used).toBe(100);
        expect(res.allocation.resource).toBe('worker-2');
        expect(res.allocation.used).toBe(100);
        expect(res.allocation.available).toBe(0);
        allocatorState = { resources: { ...allocatorState.resources, [res.resource.id]: res.resource }, allocations: { ...allocatorState.allocations, [res.allocation.id]: res.allocation } };

        await delay(1000);
    });
});