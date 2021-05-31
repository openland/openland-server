import { randomKey } from 'openland-utils/random';

export type Allocation = { id: string, resource: string, available: number, used: number };
export type Resource = { id: string, available: number, used: number };

export type AllocatorState = {
    resources: { [key: string]: Resource },
    allocations: { [key: string]: Allocation }
};

export type AllocationRes = {
    allocation: Allocation;
    resource: Resource;
};

export function allocatorExpand(state: AllocatorState, amount: number): AllocationRes | null {

    //
    // 1. Trying to expand without allocation
    //

    let existingLight: Allocation | null = null;
    for (let id of Object.keys(state.allocations)) {
        const allocation = state.allocations[id];
        if (amount <= allocation.available) {
            let remaining = allocation.available - amount;
            if (!existingLight || existingLight.available < remaining) {
                existingLight = {
                    ...allocation,
                    available: remaining,
                    used: allocation.used + amount
                };
            }
        }
    }
    if (existingLight) {
        return {
            allocation: existingLight,
            resource: state.resources[existingLight.resource]
        };
    }

    //
    // 2. Trying to expand with allocation
    //

    let existingHard: { allocation: Allocation, resource: Resource } | null = null;
    for (let id of Object.keys(state.allocations)) {
        const allocation = state.allocations[id];
        const resource = state.resources[allocation.resource];

        if (allocation.available < amount) {
            let missing = amount - allocation.available;
            if (missing <= resource.available) {
                let remaining = resource.available - missing;
                if (!existingHard || existingHard.resource.available < remaining) {
                    existingHard = {
                        allocation: {
                            ...allocation,
                            used: allocation.used + amount,
                            available: 0
                        },
                        resource: {
                            ...resource,
                            used: resource.used + amount,
                            available: resource.available - amount
                        }
                    };
                }
            }
        }
    }
    if (existingHard) {
        return existingHard;
    }

    return null;
}

export function allocatorAllocate(state: AllocatorState, used: number, available: number): AllocationRes | null {
    let resourceForAllocation: { allocation: Allocation, resource: Resource } | null = null;
    const amount = used + available;
    for (let id of Object.keys(state.resources)) {
        let resource = state.resources[id];
        if (amount <= resource.available) {
            let remaining = resource.available - amount;
            if (!resourceForAllocation || resourceForAllocation.resource.available < remaining) {
                resourceForAllocation = {
                    allocation: {
                        id: randomKey(),
                        resource: id,
                        available,
                        used
                    },
                    resource: {
                        ...resource,
                        used: resource.used + amount,
                        available: resource.available - amount
                    }
                };
            }
        }
    }
    if (resourceForAllocation) {
        return resourceForAllocation;
    }
    return null;
}

export function allocator(state: AllocatorState, args: { amount: number, preferred?: { [key: string]: boolean } }): AllocationRes | null {

    //
    // Attempt 1: Preferred expand
    //

    if (args.preferred) {
        let preferredAllocations: { [key: string]: Allocation } = {};
        for (let alloc of Object.keys(args.preferred)) {
            if (args.preferred[alloc] && state.allocations[alloc]) {
                preferredAllocations[alloc] = state.allocations[alloc];
            }
        }
        let statePreferred: AllocatorState = { ...state, allocations: preferredAllocations };
        let preferredExpand = allocatorExpand(statePreferred, args.amount);
        if (preferredExpand) {
            return preferredExpand;
        }
    }

    //
    // Attempt 2: Normal expand
    //

    let expandAttempt = allocatorExpand(state, args.amount);
    if (expandAttempt) {
        return expandAttempt;
    }

    //
    // Attempt 3: Allocation
    //

    return allocatorAllocate(state, args.amount, 0);
}