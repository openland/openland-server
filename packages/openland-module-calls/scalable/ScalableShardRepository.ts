import { randomKey } from 'openland-utils/random';
import { encoders, Subspace, TupleItem } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { SyncWorkerQueue } from 'openland-module-workers/SyncWorkerQueue';
import { ScalableShardTask } from './ScalableMediator';
import { createLogger } from '@openland/log';
import { getBudget } from './utils/getBudget';
import { ScalableAllocator } from './ScalableAllocator';
import { Allocation, allocatorAllocate, allocatorExpand, AllocatorState, Resource } from './utils/allocator';

type ShardState = {
    allocatedBudget: number;
    usedBudget: number;
    worker: string;
    consumers: {
        [key: number]: boolean
    };
};

type ShardRegion = {
    producers: {
        [key: number]: boolean
    };
    shards: {
        [key: string]: ShardState;
    }
};

type ShardMode = {
    region: ShardRegion
};

const INITIAL_BUDGET = getBudget({ producers: 5, consumers: 10 });
const CONSUMER_BUDGET = 5; // 5 Streams
const WORKER_BUDGET = 2000; // 2000 consumers

function getShardBudget(region: ShardRegion, shard: string) {
    let producers = 5;
    let consumers = 0;
    // for (let k of Object.keys(region.producers)) {
    //     if (region.producers[parseInt(k, 10)]) {
    //         producers++;
    //     }
    // }
    for (let k of Object.keys(region.shards[shard].consumers)) {
        if (region.shards[shard].consumers[parseInt(k, 10)]) {
            consumers++;
        }
    }
    return getBudget({ producers, consumers });
}

function workerKey(cid: number, session: string, shard: string) {
    return cid + '_' + session + '_' + shard;
}

const logger = createLogger('scalable');

export type PeerState = { pid: number, producer: boolean, consumer: boolean };

function buildAllocatorState(
    workers: string[],
    workerAllocations: { [key: string]: number },
    resourceAllocations?: {
        [key: string]: {
            allocatedBudget: number;
            usedBudget: number;
            worker: string;
        }
    }
): AllocatorState {
    let resources: { [key: string]: Resource } = {};
    for (let w of workers) {
        const used = workerAllocations[w] || 0;
        const available = WORKER_BUDGET - used;
        resources[w] = {
            id: w,
            used,
            available
        };
    }
    let allocations: { [key: string]: Allocation } = {};
    if (resourceAllocations) {
        for (let id of Object.keys(resourceAllocations)) {
            const alloc = resourceAllocations[id];
            const used = alloc.usedBudget;
            const available = alloc.allocatedBudget - alloc.usedBudget;
            const resource = alloc.worker;
            allocations[id] = { id, available, used, resource };
        }
    }
    return { resources, allocations };
}

export class ScalableShardRepository {

    readonly shardWorker = new SyncWorkerQueue<string, ScalableShardTask>(Store.ConferenceScalableShardsQueue, { maxAttempts: 'infinite', type: 'external' });

    private readonly sessions: Subspace<TupleItem[], string>;
    private readonly shardMode: Subspace<TupleItem[], ShardMode>;
    readonly allocator = new ScalableAllocator();

    constructor() {
        this.shardMode = Store.ConferenceScalableShardingDirectory
            .subspace(encoders.tuple.pack([0]))
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json);
        this.sessions = Store.ConferenceScalableShardingDirectory
            .subspace(encoders.tuple.pack([2]))
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.string);
    }

    //
    // Session
    //

    async getShardingState(ctx: Context, cid: number, session: string) {
        let mode = await this.shardMode.get(ctx, [cid, session]);

        return {
            mode
        };
    }

    getCurrentSession(ctx: Context, cid: number) {
        return this.sessions.get(ctx, [cid]);
    }

    async createSession(ctx: Context, cid: number) {
        const session = randomKey();
        let existing = await this.sessions.get(ctx, [cid]);
        if (existing) {
            throw Error('Session already exists');
        }
        this.sessions.set(ctx, [cid], session);

        logger.log(ctx, `[${session}]: Start session`);

        return session;
    }

    async destroySession(ctx: Context, cid: number, session: string) {

        // Clear session reference
        let existing = await this.sessions.get(ctx, [cid]);
        if (existing !== session) {
            throw Error('Session does not exist');
        }
        this.sessions.clear(ctx, [cid]);

        logger.log(ctx, `[${session}]: Stop session`);

        // Stop shards
        let mode = await this.shardMode.get(ctx, [cid, session]);
        if (mode) {
            for (let shardId of Object.keys(mode.region.shards)) {
                const shard = mode.region.shards[shardId];
                logger.log(ctx, `[${session}/${shardId}]: Stop shard`);
                await this.shardWorker.pushWork(ctx, workerKey(cid, session, shardId), { type: 'stop', cid, session, shard: shardId, budget: shard.allocatedBudget });
            }
        }

        // Delete shard data
        this.shardMode.clear(ctx, [cid, session]);
    }

    async updateSharding(ctx: Context, cid: number, session: string,
        workers: string[],
        removePeers: number[],
        addPeers: PeerState[],
        updatePeers: PeerState[]
    ) {

        // Load current allocations
        let workerAllocations = await this.allocator.getWorkersAllocations(ctx);

        // Create sharding mode if not exist
        let mode = (await this.shardMode.get(ctx, [cid, session]))!;
        if (!mode) {

            mode = { region: { producers: {}, shards: {} } };
            this.shardMode.set(ctx, [cid, session], mode);
        }

        //
        // Preprocess changes
        //

        let removedConsumers = new Set<number>();
        let removedProducers = new Set<number>();
        let addedConsumers = new Set<number>();
        let addedProducers = new Set<number>();
        function hasProducer(pid: number) {
            if (mode.region.producers[pid]) {
                return true;
            }
            return false;
        }
        function hasConsumer(pid: number) {
            for (let shardId of Object.keys(mode.region.shards)) {
                const shard = mode.region.shards[shardId];
                if (shard.consumers[pid]) {
                    return true;
                }
            }
            return false;
        }
        for (let r of removePeers) {
            if (hasConsumer(r)) {
                removedConsumers.add(r);
            }
            if (hasProducer(r)) {
                removedProducers.add(r);
            }
        }
        for (let r of addPeers) {
            if (r.consumer && !hasConsumer(r.pid)) {
                addedConsumers.add(r.pid);
            }
            if (r.producer && !hasProducer(r.pid)) {
                addedProducers.add(r.pid);
            }
        }

        for (let r of updatePeers) {
            if (!r.consumer) {
                if (hasConsumer(r.pid)) {
                    removedConsumers.add(r.pid);
                }
            }
            if (r.consumer) {
                if (!hasConsumer(r.pid)) {
                    addedConsumers.add(r.pid);
                }
            }
            if (!r.producer) {
                if (hasProducer(r.pid)) {
                    removedProducers.add(r.pid);
                }
            }
            if (r.producer) {
                if (!hasProducer(r.pid)) {
                    addedProducers.add(r.pid);
                }
            }
        }

        //
        // Remove consumers
        //
        if (removedConsumers.size > 0) {
            for (let consumer of removedConsumers) {

                // For each shard
                for (let shardId of Object.keys(mode.region.shards)) {
                    const shard = mode.region.shards[shardId];
                    if (shard.consumers[consumer]) {

                        // Update shard state
                        delete shard.consumers[consumer];

                        // Update budget
                        shard.usedBudget = shard.usedBudget - CONSUMER_BUDGET;

                        // Schedule removal
                        await this.shardWorker.pushWork(ctx, workerKey(cid, session, shardId), { type: 'remove-consumer', cid, session, shard: shardId, pid: consumer });
                    }
                }
            }

            // Persist mode
            this.shardMode.set(ctx, [cid, session], mode);
        }

        //
        // Remove producers
        //

        if (removedProducers.size > 0) {
            for (let producer of removedProducers) {
                if (mode.region.producers[producer]) {

                    // Update producer state
                    mode.region.producers[producer] = false;

                    // For each shard schedule removal
                    for (let shardId of Object.keys(mode.region.shards)) {
                        await this.shardWorker.pushWork(ctx, workerKey(cid, session, shardId), { type: 'remove-producer', cid, session, shard: shardId, pid: producer });
                    }
                }
            }

            // Persist mode
            this.shardMode.set(ctx, [cid, session], mode);
        }

        //
        // Adding consumers
        //

        if (addedConsumers.size > 0) {

            // Allocating resources
            let allocatorState = buildAllocatorState(workers, workerAllocations, mode.region.shards);
            for (let consumer of addedConsumers) {

                let expanded = allocatorExpand(allocatorState, CONSUMER_BUDGET);
                if (expanded) {

                    // Update shard
                    mode.region.shards[expanded.allocation.id].consumers[consumer] = true;

                    // Update shard budgets
                    mode.region.shards[expanded.allocation.id].usedBudget = expanded.allocation.used;
                    mode.region.shards[expanded.allocation.id].allocatedBudget = expanded.allocation.available + expanded.allocation.used;

                    // Update worker budgets
                    let workerDelta = expanded.resource.used - allocatorState.resources[expanded.allocation.resource].used;
                    if (workerDelta > 0) {
                        this.allocator.allocWorker(ctx, expanded.resource.id, workerDelta);
                    }

                    // Update allocatorState
                    allocatorState = {
                        resources: {
                            ...allocatorState.resources,
                            [expanded.resource.id]: expanded.resource
                        },
                        allocations: {
                            ...allocatorState.allocations,
                            [expanded.allocation.id]: expanded.allocation
                        }
                    };

                    // Add to schard
                    const shardId = expanded.allocation.id;
                    await this.shardWorker.pushWork(ctx, workerKey(cid, session, shardId), { type: 'add-consumer', cid, session, shard: shardId, pid: consumer });
                } else {

                    // Allocate new
                    let allocated = allocatorAllocate(allocatorState, CONSUMER_BUDGET, INITIAL_BUDGET - CONSUMER_BUDGET);
                    if (!allocated) {
                        throw Error('Unable to allocated media shard');
                    }

                    // Add shard
                    mode.region.shards[allocated.allocation.id] = {
                        allocatedBudget: INITIAL_BUDGET,
                        usedBudget: CONSUMER_BUDGET,
                        worker: allocated.resource.id,
                        consumers: { [consumer]: true }
                    };

                    // Update worker allocation
                    this.allocator.allocWorker(ctx, allocated.resource.id, INITIAL_BUDGET);

                    // Update allocatorState
                    allocatorState = {
                        resources: {
                            ...allocatorState.resources,
                            [allocated.resource.id]: allocated.resource
                        },
                        allocations: {
                            ...allocatorState.allocations,
                            [allocated.allocation.id]: allocated.allocation
                        }
                    };

                    // Create and init shard
                    const shardId = allocated.allocation.id;
                    await this.shardWorker.pushWork(ctx, workerKey(cid, session, shardId), { type: 'start', cid, session, shard: shardId, worker: allocated.resource.id });
                    await this.shardWorker.pushWork(ctx, workerKey(cid, session, shardId), { type: 'add-consumer', cid, session, shard: shardId, pid: consumer });
                    for (let p of Object.keys(mode.region.producers)) {
                        let producer = parseInt(p, 10);
                        if (mode.region.producers[producer]) {
                            await this.shardWorker.pushWork(ctx, workerKey(cid, session, shardId), { type: 'add-producer', cid, session, shard: shardId, pid: producer });
                        }
                    }
                }
            }

            // Persist mode
            this.shardMode.set(ctx, [cid, session], mode);
        }

        //
        // Adding producers
        //

        if (addedProducers.size > 0) {
            for (let producer of addedProducers) {
                if (!mode.region.producers[producer]) {

                    // Update producer state
                    mode.region.producers[producer] = true;

                    // For each shard schedule addition
                    for (let shardId of Object.keys(mode.region.shards)) {
                        await this.shardWorker.pushWork(ctx, workerKey(cid, session, shardId), { type: 'add-producer', cid, session, shard: shardId, pid: producer });
                    }
                }
            }

            // Persist mode
            this.shardMode.set(ctx, [cid, session], mode);
        }
    }

    //
    // Metrics
    //

    async getSessionsCount(ctx: Context) {
        return (await this.sessions.range(ctx, [])).length;
    }

    async getSessions(ctx: Context) {
        let sessions = (await this.sessions.range(ctx, []));
        let res: { cid: number, session: string }[] = [];
        for (let s of sessions) {
            res.push({ cid: s.key[0] as number, session: s.value });
        }
        return res;
    }

    async getSessionTotalProducers(ctx: Context, cid: number, session: string) {
        let mode = (await this.shardMode.get(ctx, [cid, session]));
        if (!mode) {
            return 0;
        }
        return Object.keys(mode.region.producers).length;
    }

    async getSessionActiveProducers(ctx: Context, cid: number, session: string) {
        let mode = (await this.shardMode.get(ctx, [cid, session]));
        if (!mode) {
            return 0;
        }
        return Object.values(mode.region.producers).filter(Boolean).length;
    }

    async getSessionShards(ctx: Context, cid: number, session: string) {
        let mode = (await this.shardMode.get(ctx, [cid, session]));
        let res: { shard: string, worker: string, consumers: number }[] = [];
        if (!mode) {
            return res;
        }
        for (let shardId of Object.keys(mode.region.shards)) {
            const shard = mode.region.shards[shardId];
            const consumers = Object.keys(shard.consumers).length;
            res.push({ shard: shardId, worker: shard.worker, consumers });
        }
        return res;
    }

    async getWorkerStats(ctx: Context) {
        const workers = (await Store.KitchenWorker.active.findAll(ctx))
            .filter((v) => !v.deleted)
            .map((v) => v.id);
        const allocations = await this.allocator.getWorkersAllocations(ctx);
        let res: { worker: string, used: number, available: number, total: number }[] = [];
        for (let w of workers) {
            const total = WORKER_BUDGET;
            const used = allocations[w] || 0;
            res.push({ worker: w, total, used, available: total - used });
        }
        return res;
    }
}