import { ShardRegionManager } from './region/ShardRegionManager';
import { ShardState } from './repo/ShardingRepository';
import { createLogger } from '@openland/log';
import { Shutdown } from 'openland-utils/Shutdown';
import { Future } from '../openland-utils/Future';
import { backoff, delayRandomized } from 'openland-utils/timer';
import { inTx, Watch } from '@openland/foundationdb';
import { createNamedContext } from '@openland/context';
import { Modules } from 'openland-modules/Modules';
import { randomKey } from 'openland-utils/random';
import { NodeState } from './repo/NodeRepository';
import { getShardId } from './getShardId';
import { ShardFactory } from './ShardFactory';

const log = createLogger('sharding');

export class ShardRegion {
    private readonly regionName: string;
    private readonly defaultRingSize: number;

    // Shard settings
    private started = false;
    private factory: ShardFactory | null = null;
    private loadedFuture = new Future();
    private loaded = false;
    private shardRegionId!: string;
    private ringSize!: number;

    // Active allocations
    private activeRegionManager: ShardRegionManager | null = null;
    private allocations!: { id: string, status: ShardState }[][];

    constructor(regionName: string, defaultRingSize: number) {
        this.regionName = regionName;
        this.defaultRingSize = defaultRingSize;
    }

    /**
     * Resolve shard key within shard ring
     * @param key shard
     */
    async getShard(key: string) {
        await this.loadedFuture.promise;
        return getShardId(key, this.ringSize);
    }

    /**
     * Get active allocation for a key
     * @param key key
     */
    async getAllocation(key: string) {
        let shard = await this.getShard(key);
        return this.allocations[shard];
    }

    /**
     * Get sharding info
     */
    async getShardingInfo() {
        await this.loadedFuture.promise;
        return { ringSize: this.ringSize, regionName: this.regionName };
    }

    /**
     * Start shard region and sync allocations
     */
    start = () => {
        if (this.started) {
            return;
        }
        this.started = true;

        let root = createNamedContext('sharding-' + this.regionName);

        let completedFuture = new Future();
        let completed = false;
        let activeWatch: Watch | null = null;

        // tslint:disable-next-line:no-floating-promises
        (async () => {
            try {
                // Resolve shard region
                let region = await backoff(root, async () => {
                    if (completed) {
                        return null;
                    }
                    return await inTx(root, async (ctx) => {
                        return await Modules.Sharding.getOrCreateShardRegion(ctx, this.regionName, this.defaultRingSize);
                    });
                });
                if (!region) {
                    return;
                }

                log.log(root, 'Loaded shard region information for ' + this.regionName);

                // Resolve initial allocations
                let initialAllocations = await backoff(root, async () => {
                    if (completed) {
                        return null;
                    }
                    return await inTx(root, async (ctx) => {
                        return await Modules.Sharding.getAllocations(ctx, region!.id);
                    });
                });
                if (!initialAllocations) {
                    return;
                }

                log.log(root, 'Loaded initial allocations for ' + this.regionName);

                // Handle loaded
                await this.onLoaded(region.id, region.ringSize, initialAllocations);

                // Refresh loop
                while (!completed) {

                    // Refetch allocations
                    let refresh = await backoff(root, async () => {
                        if (completed) {
                            return null;
                        }
                        return await inTx(root, async (ctx) => {
                            let allocations = await Modules.Sharding.getAllocations(ctx, this.shardRegionId);
                            let watch = await Modules.Sharding.watchAllocations(ctx, this.shardRegionId);
                            return { allocations, watch };
                        });
                    });
                    if (!refresh) {
                        return;
                    }

                    if (completed) {
                        refresh.watch.cancel();
                        return;
                    }
                    activeWatch = refresh.watch;

                    // Handle shard update
                    log.log(root, 'Allocations updated for ' + this.regionName);
                    await this.onShardUpdated(refresh.allocations);

                    // Delay between sync
                    try {
                        await refresh.watch.promise;
                    } catch (e) {
                        // Ignore error
                    }
                }
            } finally {
                completedFuture.resolve();
            }
        })();

        // Register shutdown
        Shutdown.registerWork({
            name: 'sharding-' + this.regionName,
            shutdown: async () => {
                completed = true;
                if (activeWatch) {
                    activeWatch.cancel();
                    activeWatch = null;
                }
                await completedFuture.promise;
            }
        });
    }

    startShard = (factory: ShardFactory) => {
        if (this.factory) {
            throw Error('Shard already started');
        }
        this.factory = factory;

        // Start allocator
        this.allocator();
    }

    //
    // Updates
    //

    private onLoaded = async (shardRegionId: string, ringSize: number, allocations: { id: string, status: ShardState }[][]) => {
        if (!this.loaded) {
            this.loaded = true;
            this.shardRegionId = shardRegionId;
            this.ringSize = ringSize;
            this.allocations = allocations;
            this.loadedFuture.resolve();
        } else {
            this.allocations = allocations;
            if (this.activeRegionManager) {
                this.activeRegionManager.applyAllocations(allocations);
            }
        }
    }

    private onShardUpdated = async (allocations: { id: string, status: ShardState }[][]) => {
        if (!this.loaded) {
            return; // Should not happen
        }
        this.allocations = allocations;
        if (this.activeRegionManager) {
            this.activeRegionManager.applyAllocations(allocations);
        }
    }

    private allocator = () => {
        let ctx = createNamedContext('sharding-allocator-' + this.regionName);
        let completedFuture = new Future();
        let completed = false;

        // tslint:disable-next-line:no-floating-promises
        (async () => {
            await this.loadedFuture.promise;
            try {
                while (true) {

                    //
                    // Reset existing shards
                    //

                    if (this.activeRegionManager) {
                        this.activeRegionManager.stop();
                        this.activeRegionManager = null;
                    }

                    //
                    // Generate fresh node id
                    //

                    let nodeId = randomKey();

                    //
                    // Initial registration
                    //

                    let nodeState = await backoff(ctx, async () => {
                        return await Modules.Sharding.registerNode(ctx, nodeId, this.shardRegionId);
                    });

                    //
                    // What if state is invalid: restart loop
                    //

                    if (nodeState !== NodeState.JOINED) {
                        continue;
                    }

                    //
                    // Assing node id and allocating required shards
                    //

                    let manager = new ShardRegionManager(this.regionName, this.shardRegionId, nodeId, this.ringSize, this.factory!);
                    this.activeRegionManager = manager;
                    manager.applyAllocations(this.allocations);

                    //
                    // Registration loop
                    //

                    while (!completed) {
                        nodeState = await backoff(ctx, async () => {
                            return await Modules.Sharding.registerNode(ctx, nodeId, this.shardRegionId);
                        });

                        if (nodeState !== NodeState.JOINED) {
                            break; // If node is expired
                        }

                        await delayRandomized(3000, 5000);
                    }

                    // Start leaving
                    while (true) {
                        nodeState = await backoff(ctx, async () => {
                            return await Modules.Sharding.registerNodeLeaving(ctx, nodeId, this.shardRegionId);
                        });

                        if (nodeState === NodeState.LEFT) {
                            break; // If node is expired
                        }

                        // Controller does not have any more shards
                        if (manager.activeShards === 0) {
                            break;
                        }

                        await delayRandomized(3000, 5000);
                    }

                    // Stop manager
                    manager.stop();
                    this.activeRegionManager = null;

                    // Wait while controller is left
                    await backoff(ctx, async () => {
                        return await Modules.Sharding.registerNodeLeft(ctx, nodeId, this.shardRegionId);
                    });
                }
            } finally {
                completedFuture.resolve();
            }
        })();

        // Register shutdown
        Shutdown.registerWork({
            name: 'sharding-allocator-' + this.regionName,
            shutdown: async () => {
                completed = true;
                await completedFuture.promise;
            }
        });
    }
}