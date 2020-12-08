import { Context } from '@openland/context';
import { Subspace } from '@openland/foundationdb';
import { TreeNode, TreeNodeType } from './storage/BTree';
import { BTreeOperations } from './storage/BTreeOperations';
import { BTreeRepository } from './storage/BTreeRepository';

export class BPlusTreeDirectory {
    readonly maxBranch: number;
    readonly minChildren: number;
    readonly maxChildren: number;
    readonly store: BTreeRepository;
    readonly ops: BTreeOperations;

    constructor(subspace: Subspace, maxBranch: number) {
        this.maxBranch = maxBranch;
        this.minChildren = Math.floor(maxBranch / 2);
        this.maxChildren = maxBranch - 1;
        this.store = new BTreeRepository(subspace);
        this.ops = new BTreeOperations(this.store);
    }

    add = async (ctx: Context, collection: Buffer, key: number) => {
        let root = await this.store.getRoot(ctx, collection);
        if (!root) {

            // Allocate root node id
            let nodeId = await this.store.allocateNodeId(ctx, collection);

            // Write root node
            await this.ops.setRootNode(ctx, collection, {
                id: nodeId,
                type: TreeNodeType.LEAF,
                values: [key]
            });
            return;
        }

        // Search from the root
        let ex = await this.ops.search(ctx, collection, key);

        // If record already exist: exit
        if (ex.values.find((v) => v === key)) {
            return;
        }

        // Add value to node
        await this.ops.addValuesToLeaf(ctx, collection, ex.id, [key]);

        // Split node if needed
        await this.splitIfNeeded(ctx, collection, ex.id);
    }

    remove = async (ctx: Context, collection: Buffer, key: number) => {
        let root = await this.store.getRoot(ctx, collection);
        if (!root) {
            return;
        }

        // Search from the root
        let ex = await this.ops.search(ctx, collection, key);

        // If record already exist: exit
        if (!ex.values.find((v) => v === key)) {
            return;
        }

        // Delete node if it is root and last value in the root
        if (ex.parent === 0 && ex.values.length === 1) {
            await this.ops.deleteNode(ctx, collection, ex.id);
            return;
        }

        // Remove value from node
        await this.ops.removeValuesFromLeaf(ctx, collection, ex.id, [key]);

        // Merge node if needed
        await this.mergeIfNeeded(ctx, collection, ex.id);
    }

    count = (ctx: Context, collection: Buffer, cursor: { from?: number | null, to?: number | null }) => {
        return this.ops.count(ctx, collection, cursor);
    }

    //
    // Rebalancing
    //

    private splitIfNeeded = async (ctx: Context, collection: Buffer, nodeId: number) => {
        let node = await this.store.readNode(ctx, collection, nodeId);
        if ((node.children.length > this.maxChildren || node.values.length > this.maxChildren)) {
            let res = await this.ops.splitNode(ctx, collection, node.id);
            await this.splitIfNeeded(ctx, collection, res.parent.id);
        }
    }

    private mergeIfNeeded = async (ctx: Context, collection: Buffer, nodeId: number) => {
        let node = await this.store.readNode(ctx, collection, nodeId);

        if (node.type === TreeNodeType.LEAF && node.values.length < this.minChildren && node.parent !== 0) {

            // Try to pick from left
            let leftId = await this.ops.findNodeSiblingLeft(ctx, collection, nodeId);
            let left: TreeNode | null = null;
            if (leftId) {
                left = await this.store.readNode(ctx, collection, leftId);
                if (left.values.length - 1 >= this.minChildren) {
                    await this.ops.moveValue(ctx, collection, left.id, nodeId, left.values[left.values.length - 1]);
                    return;
                }
            }

            // Try to pick from right
            let rightId = await this.ops.findNodeSiblingRight(ctx, collection, nodeId);
            let right: TreeNode | null = null;
            if (rightId) {
                right = await this.store.readNode(ctx, collection, rightId);
                if (right.values.length - 1 >= this.minChildren) {
                    await this.ops.moveValue(ctx, collection, right.id, nodeId, right.values[0]);
                    return;
                }
            }

            // Delete node and merge parent if needed
            await this.ops.deleteNode(ctx, collection, node.id);

            // Move values
            if (leftId) {
                await this.ops.addValuesToLeaf(ctx, collection, leftId, node.values);
            } else if (rightId) {
                await this.ops.addValuesToLeaf(ctx, collection, rightId, node.values);
            }

            // Merge parent if needed
            if (node.parent !== 0) {
                await this.mergeIfNeeded(ctx, collection, node.parent);
            }

            return;
        }

        if (node.type === TreeNodeType.INNER && node.children.length < this.minChildren && node.parent !== 0) {
            // Try to pick from left
            let leftId = await this.ops.findNodeSiblingLeft(ctx, collection, nodeId);
            let left: TreeNode | null = null;
            if (leftId) {
                left = await this.store.readNode(ctx, collection, leftId);
                if (left.children.length - 1 >= this.minChildren) {
                    await this.ops.moveNode(ctx, collection, left.children[left.children.length - 1].id, nodeId);
                    return;
                }
            }

            // Try to pick from right
            let rightId = await this.ops.findNodeSiblingRight(ctx, collection, nodeId);
            let right: TreeNode | null = null;
            if (rightId) {
                right = await this.store.readNode(ctx, collection, rightId);
                if (right.children.length - 1 >= this.minChildren) {
                    await this.ops.moveNode(ctx, collection, right.children[0].id, nodeId);
                    return;
                }
            }

            // Delete node and merge parent if needed
            await this.ops.deleteNode(ctx, collection, node.id);

            // Move values
            if (leftId) {
                await this.ops.addChildren(ctx, collection, leftId, node.children);
            } else if (rightId) {
                await this.ops.addChildren(ctx, collection, rightId, node.children);
                return;
            }

            // Merge parent if needed
            if (node.parent !== 0) {
                await this.mergeIfNeeded(ctx, collection, node.parent);
            }

            return;
        }

        // Remove inner root node
        if (node.type === TreeNodeType.INNER && node.parent === 0 && node.children.length === 1) {
            let newRoot = await this.store.readNode(ctx, collection, node.children[0].id);
            await this.ops.setRootNode(ctx, collection, { ...newRoot, parent: 0 });
        }
    }
}