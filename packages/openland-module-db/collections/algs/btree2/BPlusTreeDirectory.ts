import { Context } from '@openland/context';
import { Subspace } from '@openland/foundationdb';
import { INodeChildren, NodeChildren, TreeNode, TreeNodeType } from './storage/BTree';
import { BTreeRepository } from './storage/BTreeRepository';
import { arraySplit, isIntersects, isIntervalWithin, isWithin, recordAdd } from './utils/interval';

export type DumpedNode = {
    type: 'internal',
    children: { count: number, min: number, max: number, node: DumpedNode }[]
} | {
    type: 'leaf',
    records: number[]
};

export class BPlusTreeDirectory {
    private readonly maxBranch: number;
    private readonly store: BTreeRepository;

    constructor(subspace: Subspace, maxBranch: number) {
        this.maxBranch = maxBranch;
        this.store = new BTreeRepository(subspace);
    }

    add = async (ctx: Context, collection: Buffer, key: number) => {
        let root = await this.store.getRoot(ctx, collection);
        if (!root) {
            // Allocate root node id
            let nodeId = await this.store.allocateNodeId(ctx, collection);

            // Write node value
            await this.store.setRoot(ctx, collection, nodeId);
            await this.store.writeNode(ctx, collection, new TreeNode({
                id: nodeId,
                type: TreeNodeType.LEAF,
                values: [key]
            }));
            return;
        }

        // Search from the root
        let ex = await this.treeSearch(ctx, collection, root, key);

        // If record already exist: exit
        if (ex.values.find((v) => v === key)) {
            return;
        }

        // Add value to node
        let values = recordAdd(ex.values, key);
        await this.store.writeNode(ctx, collection, new TreeNode({ ...ex, values }));

        // Update counter and min/max
        if (ex.parent !== 0) {
            await this.updateParents(ctx, collection, ex.parent, ex.id, values[0], values[values.length - 1], values.length);
        }

        // Rebalance
        await this.rebalance(ctx, collection, ex.id);
    }

    // remove = async (ctx: Context, collection: Buffer, key: number) => {
    //     let root = await this.store.getRoot(ctx, collection);
    //     if (!root) {
    //         return;
    //     }

    //     // Search from the root
    //     let ex = await this.treeSearch(ctx, collection, root, key);

    //     // If record already exist: exit
    //     if (!ex.values.find((v) => v === key)) {
    //         return;
    //     }

    //     // Remove value from node
    //     let values = ex.values.filter((v) => v !== key);

    //     // Delete node if it was last value
    //     if (values.length === 0) {
    //         await this.deleteNode(ctx, collection, ex.id);
    //         return;
    //     }

    //     // Update node
    //     await this.store.writeNode(ctx, collection, new TreeNode({ ...ex, values }));

    //     // Update counter and min/max
    //     if (ex.parent !== 0) {
    //         await this.updateParents(ctx, collection, ex.parent, ex.id, values[0], values[values.length - 1], values.length);
    //     }

    //     // Rebalance
    //     await this.rebalance(ctx, collection, ex.id);
    // }

    count = async (ctx: Context, collection: Buffer, cursor: { from?: number | null, to?: number | null }) => {
        let root = await this.store.getRoot(ctx, collection);
        if (!root) {
            return 0;
        } else {
            return this.countNode(ctx, collection, cursor, root);
        }
    }

    private async countNode(ctx: Context, collection: Buffer, cursor: { from?: number | null, to?: number | null }, nodeId: number): Promise<number> {
        let node = await this.store.readNode(ctx, collection, nodeId);
        if (node.type === TreeNodeType.LEAF) {
            let res = 0;
            for (let n of node.values) {
                if (isWithin(cursor, n)) {
                    res++;
                }
            }
            return res;
        } else if (node.type === TreeNodeType.INNER) {
            let res = 0;
            for (let n of node.children) {
                if (isIntervalWithin(cursor, n)) {
                    res += n.count;
                } else {
                    if (isIntersects(cursor, n)) {
                        res += await this.countNode(ctx, collection, cursor, n.id);
                    }
                }
            }
            return res;
        } else {
            throw Error('Invalid type');
        }
    }

    //
    // Dump
    //

    dump = async (ctx: Context, collection: Buffer): Promise<DumpedNode | null> => {
        let root = await this.store.getRoot(ctx, collection);
        if (!root) {
            return null;
        } else {
            return await this.dumpNode(ctx, collection, root);
        }
    }

    private async dumpNode(ctx: Context, collection: Buffer, nodeId: number): Promise<DumpedNode> {
        let node = await this.store.readNode(ctx, collection, nodeId);
        if (node.type === TreeNodeType.LEAF) {
            return {
                type: 'leaf',
                records: node.values
            };
        } else if (node.type === TreeNodeType.INNER) {
            return {
                type: 'internal',
                children: await Promise.all(node.children.map(async (ch) => ({ min: ch.min, max: ch.max, count: ch.count, node: await this.dumpNode(ctx, collection, ch.id) })))
            };
        } else {
            throw Error('Unable to dump node');
        }
    }

    //
    // Search for a node to insert
    //

    private treeSearch = async (ctx: Context, collection: Buffer, nodeId: number, key: number): Promise<TreeNode> => {
        let node = await this.store.readNode(ctx, collection, nodeId);
        if (node.type === TreeNodeType.LEAF) {
            return node;
        } else if (node.type === TreeNodeType.INNER) {
            if (key < node.children[1].min) {
                return this.treeSearch(ctx, collection, node.children[0].id, key);
            } else if (node.children[node.children.length - 1].min <= key) {
                return this.treeSearch(ctx, collection, node.children[node.children.length - 1].id, key);
            } else {
                for (let i = 1; i < node.children.length - 1; i++) {
                    if (node.children[i].min <= key && node.children[i + 1].min < key) {
                        return this.treeSearch(ctx, collection, node.children[i].id, key);
                    }
                }
            }
            throw Error('Invalid node');
        }
        throw Error('Invalid node');
    }

    //
    // Rebalancing
    //

    // private deleteNode = async (ctx: Context, collection: Buffer, nodeId: number) => {
    //     let node = await this.store.readNode(ctx, collection, nodeId);
    //     await this.store.clearNode(ctx, collection, nodeId);

    //     // Return parent node
    //     if (node.parent === 0) {
    //         await this.store.setRoot(ctx, collection, null);
    //         return;
    //     }

    //     // Delete node from parent
    //     let parent = await this.store.readNode(ctx, collection, node.parent);
    //     if (parent.type !== TreeNodeType.INNER) {
    //         throw Error('Invalid node');
    //     }

    //     // Find child position
    //     let child = parent.children.findIndex((v) => v.id === parent.id);
    //     if (!child) {
    //         throw Error('Invalid node');
    //     }

    //     // Child is last - deleting a node
    //     if (parent.children.length <= 1) {
    //         await this.deleteNode(ctx, collection, node.parent);
    //         return;
    //     }

    //     // Remove children
    //     let updatedChildren = parent.children.filter((v) => v.id !== parent.id);
    //     let max = updatedChildren[updatedChildren.length - 1].max;
    //     let min = updatedChildren[0].min;
    //     let sum = 0;
    //     for (let u of updatedChildren) {
    //         sum += u.count;
    //     }

    //     // Update counters in parents
    //     await this.updateParents(ctx, collection, parent.id, nodeId, min, max, sum);

    //     // Write node
    //     parent.children = parent.children.filter((v) => v.id !== parent.id);
    //     await this.store.writeNode(ctx, collection, parent);
    // }

    private rebalance = async (ctx: Context, collection: Buffer, nodeId: number) => {
        let node = await this.store.readNode(ctx, collection, nodeId);
        if (node.children.length >= this.maxBranch - 1 || node.values.length >= this.maxBranch - 1) {
            await this.splitNode(ctx, collection, node.id);
        }
        // if (node.children.length < (this.maxBranch - 1) / 2 || node.values.length < (this.maxBranch - 1) / 2) {
        //     await this.mergeNode(ctx, collection, node.id);
        // }
    }

    // private mergeNode = async (ctx: Context, collection: Buffer, nodeId: number) => {
    //     let node = await this.store.readNode(ctx, collection, nodeId);
    //     if (node.parent === 0) {
    //         return;
    //     }
    // }

    private splitNode = async (ctx: Context, collection: Buffer, nodeId: number) => {
        let node = await this.store.readNode(ctx, collection, nodeId);

        // Resolve new parent
        let parentId: number;
        if (node.parent === 0) {
            parentId = await this.store.allocateNodeId(ctx, collection);
        } else {
            parentId = node.parent;
        }

        // Allocate new node
        let newNodeId = await this.store.allocateNodeId(ctx, collection);

        let leftCount: number;
        let rightCount: number;
        let leftMin: number;
        let leftMax: number;
        let rightMin: number;
        let rightMax: number;

        if (node.type === TreeNodeType.LEAF) {

            //
            // Split Leaf Node
            //

            let split = arraySplit(node.values);

            // Write left node
            await this.store.writeNode(ctx, collection, new TreeNode({
                id: node.id,
                type: TreeNodeType.LEAF,
                parent: parentId,
                values: split.left
            }));

            // Write right node
            await this.store.writeNode(ctx, collection, new TreeNode({
                id: newNodeId,
                type: TreeNodeType.LEAF,
                parent: parentId,
                values: split.right
            }));

            // Resolve left metrics
            leftCount = split.left.length;
            leftMin = split.left[0];
            leftMax = split.left[split.left.length - 1];

            // Resolve right metrics
            rightCount = split.right.length;
            rightMin = split.right[0];
            rightMax = split.right[split.right.length - 1];
        } else if (node.type === TreeNodeType.INNER) {

            //
            // Split Inner Node
            //

            let split = arraySplit(node.children);

            // Write left node
            await this.store.writeNode(ctx, collection, new TreeNode({
                id: node.id,
                type: TreeNodeType.INNER,
                parent: parentId,
                children: split.left
            }));

            // Write right node
            await this.store.writeNode(ctx, collection, new TreeNode({
                id: newNodeId,
                type: TreeNodeType.INNER,
                parent: parentId,
                children: split.right
            }));

            // Update parent for new items
            for (let l of split.right) {
                await this.updateReferenceToParent(ctx, collection, l.id, newNodeId);
            }

            // Resolve left metrics
            leftCount = split.left.reduce((v, i) => v + i.count, 0) /* Sum count in left */;
            leftMin = split.left[0].min;
            leftMax = split.left[split.left.length - 1].max;

            // Resolve right metrics
            rightCount = split.right.reduce((v, i) => v + i.count, 0) /* Sum count in right */;
            rightMin = split.right[0].min;
            rightMax = split.right[split.right.length - 1].max;
        } else {
            throw Error('Invalid node');
        }

        // Write parent node
        if (node.parent === 0) {
            await this.store.setRoot(ctx, collection, parentId);
            await this.store.writeNode(ctx, collection, new TreeNode({
                id: parentId,
                type: TreeNodeType.INNER,
                parent: null,
                children: [
                    new NodeChildren({ id: node.id, min: leftMin, max: leftMax, count: leftCount }),
                    new NodeChildren({ id: newNodeId, min: rightMin, max: rightMax, count: rightCount })
                ]
            }));
        } else {
            // Load parent node
            let parentNode = await this.store.readNode(ctx, collection, node.parent);
            if (parentNode.type !== TreeNodeType.INNER) {
                throw Error('Broken tree');
            }
            let index = parentNode.children.findIndex((v) => v.id === node.id);
            if (index < 0) {
                throw Error('Broken tree');
            }

            // Insert new children to parent
            let childrenLeft = parentNode.children.slice(0, index);
            let childrenRight = parentNode.children.slice(index + 1);
            let children: INodeChildren[] = [
                ...childrenLeft,
                new NodeChildren({ id: node.id, min: leftMin, max: leftMax, count: leftCount }),
                new NodeChildren({ id: newNodeId, min: rightMin, max: rightMax, count: rightCount }),
                ...childrenRight
            ];
            await this.store.writeNode(ctx, collection, new TreeNode({
                id: parentNode.id,
                type: TreeNodeType.INNER,
                parent: parentNode.parent,
                children
            }));

            // Rebalance parent
            await this.rebalance(ctx, collection, parentId);
        }
    }

    //
    // Update parents
    //

    private async updateParents(ctx: Context, collection: Buffer, nodeId: number, childrenId: number, min: number, max: number, count: number) {
        let node = await this.store.readNode(ctx, collection, nodeId);
        if (node.type !== TreeNodeType.INNER) {
            throw Error('Node type invalid');
        }
        let index = node.children.findIndex((v) => v.id === childrenId);
        if (index < 0) {
            throw Error('Unable to find children');
        }
        node.children[index].count = count;
        node.children[index].min = min;
        node.children[index].max = max;
        await this.store.writeNode(ctx, collection, node);

        if (node.parent !== 0) {
            let sum = 0;
            for (let ch of node.children) {
                sum += ch.count;
            }
            await this.updateParents(ctx, collection, node.parent, nodeId, node.children[0].min, node.children[node.children.length - 1].max, sum);
        }
    }

    private async updateReferenceToParent(ctx: Context, collection: Buffer, nodeId: number, parentId: number) {
        let node = await this.store.readNode(ctx, collection, nodeId);
        node.parent = parentId;
        await this.store.writeNode(ctx, collection, node);
    }
}