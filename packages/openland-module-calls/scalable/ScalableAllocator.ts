import { Context } from '@openland/context';
import { encoders, Subspace, TupleItem } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';

export class ScalableAllocator {
    private readonly workerAllocations: Subspace<TupleItem[], number>;

    constructor() {
        this.workerAllocations = Store.ConferenceScalableAllocatorDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.int32LE)
            .subspace([0]);
    }

    async getWorkersAllocations(ctx: Context) {
        let allocations = await this.workerAllocations.snapshotRange(ctx, []);
        let res: { [key: string]: number } = {};
        for (let a of allocations) {
            let worker = a.key[0] as string;
            res[worker] = (res[worker] || 0) + a.value;
        }
        return res;
    }

    async getWorkerAllocations(ctx: Context, worker: string) {
        return (await this.workerAllocations.snapshotGet(ctx, [worker])) || 0;
    }

    //
    // Allocations
    //

    async findWorker(ctx: Context, workers: string[], workerBudget: number, budget: number) {
        let allocations = await this.getWorkersAllocations(ctx);
        let res: { worker: string, budget: number } | null = null;
        for (let w of workers) {
            let alloc = allocations[w] || 0;
            if (alloc + budget <= workerBudget) {
                if (!res) {
                    // If first found
                    res = { worker: w, budget: alloc };
                } else if (res.budget > alloc) {
                    // If worker with more resources found
                    res = { worker: w, budget: alloc };
                }
            }
        }
        if (!res) {
            return null;
        } else {
            return res.worker;
        }
    }

    allocWorker(ctx: Context, worker: string, budget: number) {
        this.workerAllocations.addReadConflictKey(ctx, [worker]);
        this.workerAllocations.add(ctx, [worker], budget);
    }

    deallocWorker(ctx: Context, worker: string, budget: number) {
        this.workerAllocations.add(ctx, [worker], -budget);
    }
}