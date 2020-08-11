import { Metrics } from 'openland-module-monitoring/Metrics';
import { createLogger } from '@openland/log';
import { createNamedContext } from '@openland/context';
import { backoff } from 'openland-utils/timer';
import { Modules } from 'openland-modules/Modules';
import { Shard } from './../ShardFactory';
import { InvalidateSync } from '@openland/patterns';
import { ShardState } from './../repo/ShardingRepository';
import { ShardFactory } from '../ShardFactory';

const log = createLogger('sharding');

export class ShardRegionManager {
    readonly name: string;
    readonly shardId: string;
    readonly nodeId: string;
    readonly ringSize: number;
    readonly factory: ShardFactory;
    private stopped = false;
    private sync: InvalidateSync;
    private allocations!: { id: string, status: ShardState }[][];
    private allocatedShards = new Map<number, Shard>();
    private activeShardsCount = 0;

    constructor(name: string, shardId: string, nodeId: string, ringSize: number, factory: ShardFactory) {
        this.name = name;
        this.shardId = shardId;
        this.nodeId = nodeId;
        this.ringSize = ringSize;
        this.factory = factory;

        let ctx = createNamedContext('sharding-allocator-' + this.name);
        this.sync = new InvalidateSync(async () => {
            // Apply changes
            let hadChanges = true;
            while (hadChanges) {
                hadChanges = false;

                // Iterate for each shard
                for (let shard = 0; shard < this.ringSize; shard++) {
                    let allocation = (this.stopped || !this.allocations) ? undefined : this.allocations[shard].find((v) => v.id === this.nodeId);

                    // If shard need to be removed
                    if (!allocation || allocation.status === ShardState.REMOVED || allocation.status === ShardState.REMOVING) {
                        let shardInstance = this.allocatedShards.get(shard);
                        if (shardInstance) {

                            // Destroy shard
                            log.log(ctx, 'Detroying shard ' + shard + ' for ' + this.name);
                            await backoff(ctx, async () => {
                                await shardInstance!();
                            });
                            this.allocatedShards.delete(shard);

                            // Unregister shard
                            log.log(ctx, 'Unregistering shard ' + shard + ' for ' + this.name);
                            await backoff(ctx, async () => {
                                await Modules.Sharding.onAllocationRemoved(ctx, this.shardId, this.nodeId, shard);
                            });

                            // Update shard counter (have to be after successful unregistration)
                            this.activeShardsCount--;
                            Metrics.ShardingNodes.dec();

                            // Logging
                            log.log(ctx, 'Shard ' + shard + ' removed for ' + this.name);

                            // Restart loop to get fresh allocations
                            hadChanges = true;
                            break;
                        }
                    }

                    // If shard need to be created
                    if (allocation && (allocation.status === ShardState.ACTIVE || allocation.status === ShardState.ALLOCATING)) {

                        // Already created
                        if (this.allocatedShards.has(shard)) {
                            continue;
                        }

                        // Create shard
                        log.log(ctx, 'Creating shard ' + shard + ' for ' + this.name);
                        let shardInstance = await backoff(ctx, async () => {
                            return await this.factory!(shard);
                        });
                        this.allocatedShards.set(shard, shardInstance);

                        // Update shard counter (better to increment counter before registration)
                        this.activeShardsCount++;
                        Metrics.ShardingNodes.inc();

                        // Register shard
                        log.log(ctx, 'Registering shard ' + shard + ' for ' + this.name);
                        await backoff(ctx, async () => {
                            await Modules.Sharding.onAllocationReady(ctx, this.shardId, this.nodeId, shard);
                        });

                        // Logging
                        log.log(ctx, 'Shard ' + shard + ' added for ' + this.name);

                        // Restart loop to get fresh allocations
                        hadChanges = true;
                        break;
                    }
                }
            }
        });
    }

    get activeShards() {
        return this.activeShardsCount;
    }

    applyAllocations = (allocations: { id: string, status: ShardState }[][]) => {
        if (this.stopped) {
            return;
        }
        this.allocations = allocations;
        this.sync.invalidate();
    }

    stop = () => {
        this.stopped = true;
        this.sync.invalidate();
    }
}