import { Context } from '@openland/context';
import { binarySearch } from '../../utils/binarySearch';
import { arraySplit, recordAdd, isIntersects, isIntervalWithin, isWithin, childrenAdd } from './utils/interval';
import { INodeChildren, ITreeNode, TreeNode, TreeNodeType } from '../../../../structs';
import { BTreeRepository } from './BTreeRepository';

export type DumpedNode = {
    type: 'internal',
    id: number,
    parent: number | null,
    children: {
        count: number,
        min: number,
        max: number,
        node: DumpedNode
    }[]
} | {
    type: 'leaf',
    id: number,
    parent: number | null,
    values: number[]
};

function sumChildren(src: { id: number, count: number }[]) {
    let res = 0;
    for (let s of src) {
        res += s.count;
    }
    return res;
}

export class BTreeOperations {
    readonly store: BTreeRepository;

    constructor(store: BTreeRepository) {
        this.store = store;
    }

    //
    // Root
    //

    async setRootNode(ctx: Context, collection: Buffer, node: ITreeNode | null) {
        if (node === null) {
            await this.store.setRoot(ctx, collection, null);
        } else {
            await this.store.setRoot(ctx, collection, node.id);
            await this.store.writeNode(ctx, collection, new TreeNode(node));
        }
    }

    async getRootNode(ctx: Context, collection: Buffer) {
        let rootId = await this.store.getRoot(ctx, collection);
        if (rootId === null) {
            return null;
        }
        return await this.store.readNode(ctx, collection, rootId);
    }

    //
    // Leaves
    //

    async addValuesToLeaf(ctx: Context, collection: Buffer, nodeId: number, toAdd: number[]) {

        // Load leaf
        let node = await this.store.readNode(ctx, collection, nodeId);
        if (node.type !== TreeNodeType.LEAF) {
            throw Error('Invalid node');
        }

        // Update node
        let values = node.values;
        for (let k of toAdd) {
            if (binarySearch(node.values, k) >= 0) {
                throw Error('Item already exist');
            }
            values = recordAdd(values, k);
        }
        await this.store.writeNode(ctx, collection, new TreeNode({ ...node, values }));

        // Update counter and min/max
        if (node.parent !== 0) {
            await this.updateParents(ctx, collection, node.parent, node.id, values[0], values[values.length - 1], values.length);
        }
    }

    async removeValuesFromLeaf(ctx: Context, collection: Buffer, nodeId: number, toRemove: number[]) {
        // Load leaf
        let node = await this.store.readNode(ctx, collection, nodeId);
        if (node.type !== TreeNodeType.LEAF) {
            throw Error('Invalid node');
        }

        // Update values
        let values = [...node.values];
        for (let k of toRemove) {
            let index = binarySearch(values, k);
            if (index < 0) {
                throw Error('Item does not exist');
            }
            values.splice(index, 1);
        }

        // Delete node if there are no values left
        await this.store.writeNode(ctx, collection, new TreeNode({ ...node, values }));

        // Update counter and min/max
        if (node.parent !== 0) {
            await this.updateParents(ctx, collection, node.parent, node.id, values[0], values[values.length - 1], values.length);
        }
    }

    async moveValue(ctx: Context, collection: Buffer, fromNode: number, toNode: number, key: number) {
        await this.removeValuesFromLeaf(ctx, collection, fromNode, [key]);
        await this.addValuesToLeaf(ctx, collection, toNode, [key]);
    }

    //
    // Inner
    //

    async moveNode(ctx: Context, collection: Buffer, nodeId: number, toNodeId: number) {
        let node = await this.store.readNode(ctx, collection, nodeId);
        let fromNode = await this.store.readNode(ctx, collection, node.parent);
        let toNode = await this.store.readNode(ctx, collection, toNodeId);
        if (fromNode.type !== TreeNodeType.INNER) {
            throw Error('Invalid node');
        }
        if (toNode.type !== TreeNodeType.INNER) {
            throw Error('Invalid node');
        }

        // Update parent in target node
        node = new TreeNode({ ...node, parent: toNodeId });
        await this.store.writeNode(ctx, collection, node);

        // Remove from source node
        fromNode = new TreeNode({ ...fromNode, children: fromNode.children.filter((v) => v.id !== nodeId) });
        await this.store.writeNode(ctx, collection, fromNode);
        if (fromNode.parent !== 0) {
            let max = fromNode.children[fromNode.children.length - 1].max;
            let min = fromNode.children[0].min;
            let sum = sumChildren(fromNode.children);
            await this.updateParents(ctx, collection, fromNode.parent, fromNode.id, min, max, sum);
        }

        // Add to destination
        let nodeMin: number;
        let nodeMax: number;
        let nodeCount: number;
        if (node.type === TreeNodeType.INNER) {
            nodeMin = node.children[0].min;
            nodeMax = node.children[node.children.length - 1].max;
            nodeCount = sumChildren(node.children);
        } else if (node.type === TreeNodeType.LEAF) {
            nodeMin = node.values[0];
            nodeMax = node.values[node.values.length - 1];
            nodeCount = node.values.length;
        } else {
            throw Error('Invalid node');
        }
        toNode = new TreeNode({ ...toNode, children: childrenAdd(toNode.children, { id: node.id, min: nodeMin, max: nodeMax, count: nodeCount }) });
        await this.store.writeNode(ctx, collection, toNode);
        if (toNode.parent !== 0) {
            let max = toNode.children[toNode.children.length - 1].max;
            let min = toNode.children[0].min;
            let sum = sumChildren(toNode.children);
            await this.updateParents(ctx, collection, toNode.parent, toNode.id, min, max, sum);
        }
    }

    async addChildren(ctx: Context, collection: Buffer, nodeId: number, children: { id: number, min: number, max: number, count: number }[]) {
        let node = await this.store.readNode(ctx, collection, nodeId);
        if (node.type !== TreeNodeType.INNER) {
            throw Error('Invalid node');
        }
        let added = node.children;
        for (let ch of children) {
            added = childrenAdd(added, ch);
        }
        node = new TreeNode({ ...node, children: added });
        await this.store.writeNode(ctx, collection, node);
        if (node.parent !== 0) {
            let max = node.children[node.children.length - 1].max;
            let min = node.children[0].min;
            let sum = sumChildren(node.children);
            await this.updateParents(ctx, collection, node.parent, node.id, min, max, sum);
        }
    }

    //
    // Deletion
    //

    async deleteNode(ctx: Context, collection: Buffer, nodeId: number) {
        let node = await this.store.readNode(ctx, collection, nodeId);
        await this.store.clearNode(ctx, collection, nodeId);

        // Return parent node
        if (node.parent === 0) {
            await this.store.setRoot(ctx, collection, null);
            return;
        }

        // Delete node from parent
        let parent = await this.store.readNode(ctx, collection, node.parent);
        if (parent.type !== TreeNodeType.INNER) {
            throw Error('Invalid node');
        }

        // Find child position
        let child = parent.children.findIndex((v) => v.id === node.id);
        if (child < 0) {
            throw Error('Invalid node');
        }

        // Write node
        parent.children = parent.children.filter((v) => v.id !== node.id);
        await this.store.writeNode(ctx, collection, parent);

        // Update parents
        if (parent.parent !== 0) {
            let max = parent.children[parent.children.length - 1].max;
            let min = parent.children[0].min;
            let sum = sumChildren(parent.children);

            // Update counters in parents
            await this.updateParents(ctx, collection, parent.id, nodeId, min, max, sum);
        }
    }

    /**
     * Splits node in two
     * @param ctx context
     * @param collection collection
     * @param nodeId node to split
     */
    async splitNode(ctx: Context, collection: Buffer, nodeId: number) {
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
        let left: TreeNode;
        let right: TreeNode;

        if (node.type === TreeNodeType.LEAF) {

            //
            // Split Leaf Node
            //

            let split = arraySplit(node.values);

            // Write left node
            left = new TreeNode({
                id: node.id,
                type: TreeNodeType.LEAF,
                parent: parentId,
                values: split.left
            });
            await this.store.writeNode(ctx, collection, left);

            // Write right node
            right = new TreeNode({
                id: newNodeId,
                type: TreeNodeType.LEAF,
                parent: parentId,
                values: split.right
            });
            await this.store.writeNode(ctx, collection, right);

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
            left = new TreeNode({
                id: node.id,
                type: TreeNodeType.INNER,
                parent: parentId,
                children: split.left
            });
            await this.store.writeNode(ctx, collection, left);

            // Write right node
            right = new TreeNode({
                id: newNodeId,
                type: TreeNodeType.INNER,
                parent: parentId,
                children: split.right
            });
            await this.store.writeNode(ctx, collection, right);

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
            let root = new TreeNode({
                id: parentId,
                type: TreeNodeType.INNER,
                parent: null,
                children: [
                    { id: node.id, min: leftMin, max: leftMax, count: leftCount },
                    { id: newNodeId, min: rightMin, max: rightMax, count: rightCount }
                ]
            });
            await this.setRootNode(ctx, collection, root);
            return {
                parent: root,
                left,
                right
            };
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
                { id: node.id, min: leftMin, max: leftMax, count: leftCount },
                { id: newNodeId, min: rightMin, max: rightMax, count: rightCount },
                ...childrenRight
            ];
            let parent = new TreeNode({
                id: parentNode.id,
                type: TreeNodeType.INNER,
                parent: parentNode.parent,
                children
            });
            await this.store.writeNode(ctx, collection, new TreeNode({
                id: parentNode.id,
                type: TreeNodeType.INNER,
                parent: parentNode.parent,
                children
            }));
            return {
                parent,
                left,
                right
            };
        }
    }

    async search(ctx: Context, collection: Buffer, key: number): Promise<TreeNode> {
        let root = await this.store.getRoot(ctx, collection);
        if (!root) {
            throw Error('Empty tree');
        }
        return this.treeSearch(ctx, collection, root, key);
    }

    private async treeSearch(ctx: Context, collection: Buffer, nodeId: number, key: number): Promise<TreeNode> {
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
                    if (node.children[i].min <= key && key < node.children[i + 1].min) {
                        return this.treeSearch(ctx, collection, node.children[i].id, key);
                    }
                }
            }
            throw Error('Invalid node');
        }
        throw Error('Invalid node');
    }

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
    // Siblings
    //

    async findNodeSiblingLeft(ctx: Context, collection: Buffer, nodeId: number): Promise<number | null> {
        let node = await this.store.readNode(ctx, collection, nodeId);

        // Root doesn't have siblings
        if (node.parent === 0) {
            return null;
        }

        let parent = await this.store.readNode(ctx, collection, node.parent);
        let index = parent.children.findIndex((v) => v.id === nodeId);
        if (index < 0) {
            throw Error('Invalid node');
        }

        // Is not last children - return next sibling
        if (0 < index) {
            return parent.children[index - 1].id;
        }

        // Searching from siblings of parent
        let rightParentSiblingId = await this.findNodeSiblingLeft(ctx, collection, parent.id);
        if (!rightParentSiblingId) {
            return null;
        }
        let rightParent = await this.store.readNode(ctx, collection, rightParentSiblingId);
        return rightParent.children[rightParent.children.length - 1].id;
    }

    async findNodeSiblingRight(ctx: Context, collection: Buffer, nodeId: number): Promise<number | null> {
        let node = await this.store.readNode(ctx, collection, nodeId);

        // Root doesn't have siblings
        if (node.parent === 0) {
            return null;
        }

        let parent = await this.store.readNode(ctx, collection, node.parent);
        let index = parent.children.findIndex((v) => v.id === nodeId);
        if (index < 0) {
            throw Error('Invalid node');
        }

        // Is not last children - return next sibling
        if (index < parent.children.length - 1) {
            return parent.children[index + 1].id;
        }

        // Searching from siblings of parent
        let rightParentSiblingId = await this.findNodeSiblingRight(ctx, collection, parent.id);
        if (!rightParentSiblingId) {
            return null;
        }
        let rightParent = await this.store.readNode(ctx, collection, rightParentSiblingId);
        return rightParent.children[0].id;
    }

    //
    // Debug
    //

    async dumpAll(ctx: Context, collection: Buffer): Promise<DumpedNode | null> {
        let root = await this.store.getRoot(ctx, collection);
        if (!root) {
            return null;
        } else {
            return await this.dumpNode(ctx, collection, root);
        }
    }

    async dumpNode(ctx: Context, collection: Buffer, nodeId: number): Promise<DumpedNode> {
        let node = await this.store.readNode(ctx, collection, nodeId);
        if (node.type === TreeNodeType.LEAF) {
            return {
                type: 'leaf',
                id: node.id,
                parent: node.parent !== 0 ? node.parent : null,
                values: node.values
            };
        } else if (node.type === TreeNodeType.INNER) {
            return {
                type: 'internal',
                id: node.id,
                parent: node.parent !== 0 ? node.parent : null,
                children: await Promise.all(node.children.map(async (ch) => ({ min: ch.min, max: ch.max, count: ch.count, node: await this.dumpNode(ctx, collection, ch.id) })))
            };
        } else {
            throw Error('Unable to dump node');
        }
    }

    //
    // Maintenance
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