import { ShardRegion } from './ShardRegion';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { ShardingRepository } from './repo/ShardingRepository';
import { injectable } from 'inversify';
import { startShardingScheduler } from './workers/startShardingScheduler';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';

@injectable()
export class ShardingModule {

    private repo = new ShardingRepository(Store.ShardingDataDirectory);

    readonly testShard = new ShardRegion('test-sharding', 100);

    start = async () => {
        if (serverRoleEnabled('admin')) {
            startShardingScheduler(this.repo);

            // Start test shard
            this.testShard.start(async () => {
                // Create shard
                return async () => {
                    // Destroy shard
                };
            });
        }
    }

    watchAllocations(parent: Context, shardRegion: string) {
        return this.repo.watchAllocations(parent, shardRegion);
    }

    getAllocations(parent: Context, shardRegion: string) {
        return this.repo.getAllocations(parent, shardRegion);
    }

    getShardRegions(parent: Context) {
        return this.repo.getShardRegions(parent);
    }

    getOrCreateShardRegion(parent: Context, name: string, defaultRingSize: number) {
        return this.repo.getOrCreateShardRegion(parent, name, defaultRingSize);
    }

    registerNode(parent: Context, nodeId: string, shardId: string) {
        return this.repo.registerNode(parent, nodeId, shardId);
    }

    registerNodeLeaving(parent: Context, nodeId: string, shardId: string) {
        return this.repo.registerNodeLeaving(parent, nodeId, shardId);
    }

    registerNodeLeft(parent: Context, nodeId: string, shardId: string) {
        return this.repo.registerNodeLeft(parent, nodeId, shardId);
    }

    onAllocationReady(parent: Context, shardId: string, node: string, shard: number) {
        return this.repo.onAllocationReady(parent, shardId, node, shard);
    }

    onAllocationRemoved(parent: Context, shardId: string, node: string, shard: number) {
        return this.repo.onAllocationRemoved(parent, shardId, node, shard);
    }
}