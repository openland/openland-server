import { createNamedContext } from '@openland/context';
import { Database, inTx } from '@openland/foundationdb';
import { ShardingRepository, ShardState } from './ShardingRepository';
import { NodeState } from './NodeRepository';

describe('ShardingRepository', () => {
    it('should register shard and nodes', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest();
        let repo = new ShardingRepository(db.allKeys);

        // Create shard region
        let shard = await inTx(root, async (ctx) => {
            return await repo.getOrCreateShardRegion(ctx, 'users', 100);
        });
        expect(shard.ringSize).toBe(100);

        // Open existing shard region
        let shard2 = await inTx(root, async (ctx) => {
            return await repo.getOrCreateShardRegion(ctx, 'users', 200);
        });
        expect(shard2.ringSize).toBe(100);
        expect(shard2.id).toBe(shard.id);

        // Check list of all shard regions
        let shards = await repo.getShardRegions(root);
        expect(shards.length).toBe(1);
        expect(shards[0].name).toBe('users');
        expect(shards[0].ringSize).toBe(100);
        expect(shards[0].id).toBe(shard.id);

        // Initial allocations must be empty
        let allocations = await repo.getAllocations(root, shard.id);
        expect(allocations.length).toBe(100);
        for (let i = 0; i < 100; i++) {
            expect(allocations[0].length).toBe(0);
        }

        // Node Join
        let reg1 = await repo.nodes.registerNode(root, 'node-1', shard.id, 5000);
        expect(reg1).toBe(NodeState.JOINED);
        let reg2 = await repo.nodes.registerNode(root, 'node-2', shard.id, 6000);
        expect(reg2).toBe(NodeState.JOINED);
        let reg3 = await repo.nodes.registerNode(root, 'node-3', shard.id, 7000);
        expect(reg3).toBe(NodeState.JOINED);

        // Check nodes
        let nodes = await repo.nodes.getShardRegionNodes(root, shard.id);
        expect(nodes).toMatchObject([
            { id: 'node-1', state: NodeState.JOINED },
            { id: 'node-2', state: NodeState.JOINED },
            { id: 'node-3', state: NodeState.JOINED }
        ]);

        // Leaving
        let state = await repo.nodes.registerNodeLeaving(root, 'node-1', shard.id, 5500);
        expect(state).toBe(NodeState.LEAVING);

        // Region
        nodes = await repo.nodes.getShardRegionNodes(root, shard.id);
        expect(nodes).toMatchObject([
            { id: 'node-1', state: NodeState.LEAVING },
            { id: 'node-2', state: NodeState.JOINED },
            { id: 'node-3', state: NodeState.JOINED }
        ]);

        // Mark as left
        await repo.nodes.registerNodeLeft(root, 'node-1', shard.id, 5600);

        // Check nodes
        nodes = await repo.nodes.getShardRegionNodes(root, shard.id);
        expect(nodes).toMatchObject([
            { id: 'node-1', state: NodeState.LEFT },
            { id: 'node-2', state: NodeState.JOINED },
            { id: 'node-3', state: NodeState.JOINED }
        ]);

        // Handle timeouts
        await repo.nodes.handleTimeouts(root, 5650);

        // Check nodes
        nodes = await repo.nodes.getShardRegionNodes(root, shard.id);
        expect(nodes).toMatchObject([
            { id: 'node-2', state: NodeState.JOINED },
            { id: 'node-3', state: NodeState.JOINED }
        ]);

        // Refresh update
        await repo.nodes.registerNode(root, 'node-2', shard.id, 6500);

        // Refresh with older timeout
        await repo.nodes.registerNode(root, 'node-2', shard.id, 6400);

        // Handle timeouts
        await repo.nodes.handleTimeouts(root, 6100);

        // Check nodes
        nodes = await repo.nodes.getShardRegionNodes(root, shard.id);
        expect(nodes).toMatchObject([
            { id: 'node-2', state: NodeState.JOINED },
            { id: 'node-3', state: NodeState.JOINED }
        ]);

        // Handle timeouts
        await repo.nodes.handleTimeouts(root, 6501);

        // Check nodes
        nodes = await repo.nodes.getShardRegionNodes(root, shard.id);
        expect(nodes).toMatchObject([
            { id: 'node-3', state: NodeState.JOINED }
        ]);

        // Handle timeouts
        await repo.nodes.handleTimeouts(root, 7001);

        // Check nodes
        nodes = await repo.nodes.getShardRegionNodes(root, shard.id);
        expect(nodes).toMatchObject([]);
    });

    it('should schedule shards', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest();
        let repo = new ShardingRepository(db.allKeys);

        // Shard
        let shard = await repo.getOrCreateShardRegion(root, 'users', 9);

        // Nodes
        await repo.nodes.registerNode(root, 'node-1', shard.id, 5000);
        await repo.nodes.registerNode(root, 'node-2', shard.id, 5000);
        await repo.nodes.registerNode(root, 'node-3', shard.id, 5000);

        // Schedule
        await repo.scheduleShards(root, shard.id);

        // Allocations
        let allocations = await repo.getAllocations(root, shard.id);
        expect(allocations).toMatchObject(
            [
                [{ id: 'node-1', status: ShardState.ALLOCATING }],
                [{ id: 'node-2', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-1', status: ShardState.ALLOCATING }],
                [{ id: 'node-2', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-1', status: ShardState.ALLOCATING }],
                [{ id: 'node-2', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }]
            ]
        );

        // Mark node as leaving
        await repo.registerNodeLeaving(root, 'node-1', shard.id);
        allocations = await repo.getAllocations(root, shard.id);
        expect(allocations).toMatchObject(
            [
                [{ id: 'node-2', status: ShardState.ALLOCATING }],
                [{ id: 'node-2', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-2', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-2', status: ShardState.ALLOCATING }],
                [{ id: 'node-2', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }]
            ]
        );

        // Mark node as left
        await repo.registerNodeLeft(root, 'node-1', shard.id);
        allocations = await repo.getAllocations(root, shard.id);
        expect(allocations).toMatchObject(
            [
                [{ id: 'node-2', status: ShardState.ALLOCATING }],
                [{ id: 'node-2', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-2', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-2', status: ShardState.ALLOCATING }],
                [{ id: 'node-2', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }]
            ]
        );

        // Mark as allocated
        await repo.onAllocationReady(root, shard.id, 'node-2', 0);
        await repo.onAllocationReady(root, shard.id, 'node-3', 1); // Should be ignored
        allocations = await repo.getAllocations(root, shard.id);
        expect(allocations).toMatchObject(
            [
                [{ id: 'node-2', status: ShardState.ACTIVE }],
                [{ id: 'node-2', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-2', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-2', status: ShardState.ALLOCATING }],
                [{ id: 'node-2', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }]
            ]
        );

        // Mark node as leaving
        await repo.registerNodeLeaving(root, 'node-2', shard.id);
        allocations = await repo.getAllocations(root, shard.id);
        expect(allocations).toMatchObject(
            [
                [{ id: 'node-2', status: ShardState.ACTIVE }, { id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }]
            ]
        );

        // Mark shard as allocated
        await repo.onAllocationReady(root, shard.id, 'node-3', 0);
        allocations = await repo.getAllocations(root, shard.id);
        expect(allocations).toMatchObject(
            [
                [{ id: 'node-2', status: ShardState.REMOVING }, { id: 'node-3', status: ShardState.ACTIVE }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }]
            ]
        );

        // Mark as removed
        await repo.onAllocationRemoved(root, shard.id, 'node-2', 0);
        allocations = await repo.getAllocations(root, shard.id);
        expect(allocations).toMatchObject(
            [
                [{ id: 'node-3', status: ShardState.ACTIVE }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }],
                [{ id: 'node-3', status: ShardState.ALLOCATING }]
            ]
        );
    });
});