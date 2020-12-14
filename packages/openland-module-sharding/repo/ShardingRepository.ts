import { NodeRepository, NodeState } from './NodeRepository';
import { Subspace, encoders, inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { randomKey } from 'openland-utils/random';

const ZERO = Buffer.alloc(0);

export type ID = string;

export enum ShardState {
    ALLOCATING = 0,
    ACTIVE = 1,
    REMOVING = 2,
    REMOVED = 3
}

export class ShardingRepository {

    readonly nodes: NodeRepository;
    private readonly directory: Subspace;
    private readonly registry: Subspace;
    private readonly shards: Subspace;
    private readonly shardVersions: Subspace;

    constructor(directory: Subspace) {
        this.directory = directory;
        this.nodes = new NodeRepository(this.directory
            .subspace(encoders.tuple.pack([1])));
        this.registry = this.directory
            .subspace(encoders.tuple.pack([0]));
        this.shards = this.directory
            .subspace(encoders.tuple.pack([2]));
        this.shardVersions = this.directory
            .subspace(encoders.tuple.pack([3]));
    }

    //
    // Sharding
    //

    async watchAllocations(parent: Context, shardRegion: ID) {
        return await inTx(parent, async (ctx) => {
            let watch = this.shardVersions.watch(ctx, encoders.tuple.pack([shardRegion]));
            return watch;
        });
    }

    async getAllocations(parent: Context, shardRegion: ID) {
        return await inTx(parent, async (ctx) => {

            // Read shard region
            let region = await this.getShardRegion(ctx, shardRegion);

            // Read all allocations
            let allocatedRaw = await this.shards.range(ctx, encoders.tuple.pack([shardRegion]));
            let allocations = new Map<number, { id: string, status: ShardState }[]>();
            for (let allocation of allocatedRaw) {
                let tuple = encoders.tuple.unpack(allocation.key);
                let shard = tuple[1] as number;
                let node = tuple[2] as string;
                let statusRaw = encoders.tuple.unpack(allocation.value)[0] as number;
                let status: ShardState;
                if (statusRaw === ShardState.ACTIVE) {
                    status = ShardState.ACTIVE;
                } else if (statusRaw === ShardState.ALLOCATING) {
                    status = ShardState.ALLOCATING;
                } else if (statusRaw === ShardState.REMOVING) {
                    status = ShardState.REMOVING;
                } else {
                    continue;
                }
                let shardAllocations: { id: string, status: ShardState }[];
                if (allocations.has(shard)) {
                    shardAllocations = allocations.get(shard)!;
                } else {
                    shardAllocations = [];
                    allocations.set(shard, shardAllocations);
                }
                shardAllocations.push({ id: node, status });
            }

            // Repack shards
            let res: { id: string, status: ShardState }[][] = [];
            for (let i = 0; i < region.ringSize; i++) {
                let shards = allocations.get(i);
                if (!shards) {
                    res[i] = [];
                } else {
                    res[i] = shards;
                }
            }
            return res;
        });
    }

    async onAllocationReady(parent: Context, region: ID, node: ID, shard: number) {
        await inTx(parent, async (ctx) => {
            let existing = await this.shards.get(ctx, encoders.tuple.pack([region, shard, node]));
            if (!existing) {
                return;
            }
            let tuple = encoders.tuple.unpack(existing);
            if (tuple[0] === ShardState.ALLOCATING) {
                this.markAllocationAsActive(ctx, region, shard, node);
                await this.scheduleShards(ctx, region);
            }
        });
    }

    async onAllocationRemoved(parent: Context, region: ID, node: ID, shard: number) {
        await inTx(parent, async (ctx) => {
            let existing = await this.shards.get(ctx, encoders.tuple.pack([region, shard, node]));
            if (!existing) {
                return;
            }
            let tuple = encoders.tuple.unpack(existing);
            if (tuple[0] === ShardState.REMOVING) {
                this.removeAllocation(ctx, region, shard, node);
                await this.scheduleShards(ctx, region);
            }
        });
    }

    async scheduleShards(parent: Context, region: ID) {

        await inTx(parent, async (ctx) => {

            // Read all active nodes
            let nodes = await this.nodes.getShardRegionNodes(ctx, region);
            let nodeStates = new Map<string, NodeState>();
            let allocableNodes = new Set<string>();
            for (let n of nodes) {
                nodeStates.set(n.id, n.state);
                if (n.state === NodeState.JOINED) {
                    allocableNodes.add(n.id);
                }
            }

            // Read current allocations
            let existingAllocations = await this.getAllocations(ctx, region);

            // Clean removed shards
            for (let shard = 0; shard < existingAllocations.length; shard++) {
                for (let allocation of existingAllocations[shard]) {

                    // Resolve node state for allocation
                    let nodeState = nodeStates.get(allocation.id)!;
                    if (nodeState === undefined) {
                        nodeState = NodeState.LEFT;
                    }

                    // Remove allocation if node left
                    if (nodeState === NodeState.LEFT) {
                        allocation.status = ShardState.REMOVED;
                        this.removeAllocation(ctx, region, shard, allocation.id);
                    }

                    // Remove allocation if node is leaving and allocation is not allocated yet
                    if (nodeState === NodeState.LEAVING) {
                        if (allocation.status !== ShardState.ACTIVE && allocation.status !== ShardState.REMOVING) {
                            // Remove immediatelly if it wasn't allocated
                            allocation.status = ShardState.REMOVED;
                            this.removeAllocation(ctx, region, shard, allocation.id);
                        }
                    }
                }
            }

            // Remove multiple active shards
            for (let shard = 0; shard < existingAllocations.length; shard++) {
                let allocations = 0;
                let nonSchedulableAllocations = 0;
                for (let allocation of existingAllocations[shard]) {
                    if (allocation.status === ShardState.ACTIVE) {
                        allocations++;
                        if (!allocableNodes.has(allocation.id)) {
                            nonSchedulableAllocations++;
                        }
                    }
                }
                if (allocations > 1) {
                    // Remove all non schedulable allocations
                    if (nonSchedulableAllocations < allocations) {
                        allocations -= nonSchedulableAllocations;
                        for (let allocation of existingAllocations[shard]) {
                            if (allocation.status === ShardState.ACTIVE && !allocableNodes.has(allocation.id)) {
                                allocation.status = ShardState.REMOVING;
                                this.markAllocationAsRemoving(ctx, region, shard, allocation.id);
                            }
                        }
                    }

                    // Remove duplicates
                    if (allocations > 1) {
                        for (let allocation of existingAllocations[shard]) {
                            if (allocation.status === ShardState.ACTIVE) {
                                allocation.status = ShardState.REMOVING;
                                this.markAllocationAsRemoving(ctx, region, shard, allocation.id);
                                allocations--;
                            }
                        }
                    }
                }
            }

            // If no allocable nodes - exit
            if (allocableNodes.size === 0) {
                return;
            }

            // Calculate node workload distribution
            let nodeAllocations = new Map<string, number>();
            for (let shard = 0; shard < existingAllocations.length; shard++) {
                for (let allocation of existingAllocations[shard]) {
                    if (allocation.status === ShardState.ALLOCATING || allocation.status === ShardState.ACTIVE || allocation.status === ShardState.REMOVING) {
                        let ex = nodeAllocations.get(allocation.id) || 0;
                        ex++;
                        nodeAllocations.set(allocation.id, ex);
                    }
                }
            }

            // Find not allocated shards
            let missing = new Set<number>();
            for (let shard = 0; shard < existingAllocations.length; shard++) {
                let allocated = 0;
                for (let allocation of existingAllocations[shard]) {

                    // Resolve node state for allocation
                    let nodeState = nodeStates.get(allocation.id)!;
                    if (nodeState === undefined) {
                        nodeState = NodeState.LEFT;
                    }

                    // Check if allocated
                    if (nodeState !== NodeState.LEAVING && nodeState !== NodeState.LEFT) {
                        if (allocation.status === ShardState.ACTIVE || allocation.status === ShardState.ALLOCATING) {
                            allocated++;
                        }
                    }
                }
                if (allocated === 0) {
                    missing.add(shard);
                }
            }

            // Allocate nodes
            let allocableNodesArray = [...allocableNodes];
            for (let shard of missing) {
                let target = allocableNodesArray[0];
                let load = nodeAllocations.get(target) || 0;
                for (let i = 1; i < allocableNodesArray.length; i++) {
                    let ld = nodeAllocations.get(allocableNodesArray[i]) || 0;
                    if (ld < load) {
                        load = ld;
                        target = allocableNodesArray[i];
                    }
                }
                nodeAllocations.set(target, load + 1);
                this.markAllocationAsAllocating(ctx, region, shard, target);
            }
        });
    }

    private removeAllocation(ctx: Context, region: string, shard: number, node: string) {
        this.shards.clear(ctx, encoders.tuple.pack([region, shard, node]));
        this.markAllocationsChanged(ctx, region);
    }

    private markAllocationAsRemoving(ctx: Context, region: string, shard: number, node: string) {
        this.shards.set(ctx, encoders.tuple.pack([region, shard, node]), encoders.tuple.pack([ShardState.REMOVING]));
        this.markAllocationsChanged(ctx, region);
    }

    private markAllocationAsAllocating(ctx: Context, region: string, shard: number, node: string) {
        this.shards.set(ctx, encoders.tuple.pack([region, shard, node]), encoders.tuple.pack([ShardState.ALLOCATING]));
        this.markAllocationsChanged(ctx, region);
    }

    private markAllocationAsActive(ctx: Context, region: string, shard: number, node: string) {
        this.shards.set(ctx, encoders.tuple.pack([region, shard, node]), encoders.tuple.pack([ShardState.ACTIVE]));
        this.markAllocationsChanged(ctx, region);
    }

    private markAllocationsChanged(ctx: Context, region: string) {
        this.shardVersions.setVersionstampedValue(ctx, encoders.tuple.pack([region]), ZERO);
    }

    //
    // Shard Regions
    //

    async getOrCreateShardRegion(parent: Context, name: string, defaultRingSize: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await this.registry.get(ctx, encoders.tuple.pack([0, name]));
            if (existing) {
                let tuple = encoders.tuple.unpack(existing);
                let id = tuple[0] as ID;
                let ringSize = tuple[1] as number;
                return { id, ringSize };
            } else {
                let id = randomKey();
                this.registry.set(ctx, encoders.tuple.pack([0, name]), encoders.tuple.pack([id, defaultRingSize]));
                this.registry.set(ctx, encoders.tuple.pack([1, id]), encoders.tuple.pack([name, defaultRingSize]));
                return { id, ringSize: defaultRingSize };
            }
        });
    }

    async getShardRegion(parent: Context, shardRegion: ID) {
        return await inTx(parent, async (ctx) => {
            let shard = await this.registry.get(ctx, encoders.tuple.pack([1, shardRegion]));
            if (!shard) {
                throw Error('Unable to find shard ' + shardRegion);
            }
            let tuple = encoders.tuple.unpack(shard);
            let name = tuple[0] as string;
            let ringSize = tuple[1] as number;
            return { name, shardRegion, ringSize };
        });
    }

    async getShardRegions(parent: Context) {
        return await inTx(parent, async (ctx) => {
            let allShards = await this.registry.range(ctx, encoders.tuple.pack([0]));
            let shards: { name: string, id: ID, ringSize: number }[] = [];
            for (let sh of allShards) {
                let name = encoders.tuple.unpack(sh.key)[1] as string;
                let tuple = encoders.tuple.unpack(sh.value);
                let id = tuple[0] as ID;
                let ringSize = tuple[1] as number;
                shards.push({ name, id, ringSize });
            }
            return shards;
        });
    }

    //
    // Node
    //

    async registerNode(parent: Context, nodeId: ID, shardId: ID): Promise<NodeState> {
        return await inTx(parent, async (ctx) => {
            let res = await this.nodes.registerNode(ctx, nodeId, shardId, Date.now() + 15000);
            await this.scheduleShards(ctx, shardId);
            return res;
        });
    }

    async registerNodeLeaving(parent: Context, nodeId: ID, shardId: ID): Promise<NodeState> {
        return await inTx(parent, async (ctx) => {
            let res = await this.nodes.registerNodeLeaving(ctx, nodeId, shardId, Date.now() + 15000);
            await this.scheduleShards(ctx, shardId);
            return res;
        });
    }

    async registerNodeLeft(parent: Context, nodeId: ID, shardId: ID) {
        return await inTx(parent, async (ctx) => {
            let res = await this.nodes.registerNodeLeft(ctx, nodeId, shardId, Date.now() + 60 * 60 * 1000);
            await this.scheduleShards(ctx, shardId);
            return res;
        });
    }

    async handleScheduling(parent: Context) {
        await inTx(parent, async (ctx) => {

            // Handle timeouts
            await this.nodes.handleTimeouts(ctx, Date.now());

            // Update regions
            let shards = await this.getShardRegions(ctx);
            for (let sh of shards) {
                await this.scheduleShards(ctx, sh.id);
            }
        });
    }
}