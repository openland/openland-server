import { Context } from '@openland/context';
import { encoders, Subspace, TupleItem } from '@openland/foundationdb';
import { delay } from '@openland/foundationdb/lib/utils';
import { arraySplit, LeafNode, Node, packNode, recordAdd, unpackNode } from './impl/Node';

const SUBSPACE_ROOT = 0;
const SUBSPACE_COUNTER = 1;
const SUBSPACE_NODES = 2;

export type DumpedNode = {
    type: 'internal',
    children: { count: number, min: number, max: number, node: DumpedNode }[]
} | {
    type: 'leaf',
    records: number[]
};

function isWithin(cursor: { from?: number | null, to?: number | null }, key: number) {
    if ((cursor.to !== null && cursor.to !== undefined) && (cursor.to < key)) {
        return false;
    }
    if ((cursor.from !== null && cursor.from !== undefined) && (key < cursor.from)) {
        return false;
    }
    return true;
}

function isIntervalWithin(cursor: { from?: number | null, to?: number | null }, interval: { min: number, max: number }) {
    if (cursor.from !== null && cursor.from !== undefined) {
        if (interval.min < cursor.from) {
            return false;
        }
    }
    if (cursor.to !== null && cursor.to !== undefined) {
        if (cursor.to < interval.max) {
            return false;
        }
    }
    return true;
}

function isIntersects(cursor: { from?: number | null, to?: number | null }, interval: { min: number, max: number }) {
    let from = cursor.from || Number.MIN_SAFE_INTEGER;
    let to = cursor.to || Number.MAX_SAFE_INTEGER;
    if (from > interval.max) {
        return false;
    }
    if (interval.min > to) {
        return false;
    }
    return true;
}

export class BPlusTreeDirectory {
    readonly subspace: Subspace<TupleItem[], Buffer>;
    readonly maxBranch: number;

    constructor(subspace: Subspace, maxBranch: number) {
        this.maxBranch = maxBranch;
        this.subspace = subspace.withKeyEncoding(encoders.tuple);
    }

    add = async (ctx: Context, collection: Buffer, key: number) => {
        let root = await this.readRoot(ctx, collection);
        if (!root) {
            // Allocate root node id
            let nodeId = await this.allocateNodeId(ctx, collection);

            // Write node value
            this.writeRoot(ctx, collection, nodeId);
            this.writeNode(ctx, collection, { type: 'leaf', id: nodeId, parent: null, children: [key] });
            return;
        }

        // Search from the root
        let ex = await this.treeSearch(ctx, collection, root.id, key);

        // If record already exist: exit
        if (ex.children.find((v) => v === key)) {
            return;
        }

        // Add record to node
        let newRecords = recordAdd(ex.children, key);
        this.writeNode(ctx, collection, { ...ex, children: newRecords });

        // Update counter
        if (ex.parent !== null) {
            await this.updateCount(ctx, collection, ex.parent, ex.id, newRecords.length);
            await this.updateMinMax(ctx, collection, ex.parent, ex.id, key);
        }

        // Rebalance
        await this.rebalance(ctx, collection, ex.id);
    }

    count = async (ctx: Context, collection: Buffer, cursor: { from?: number | null, to?: number | null }) => {
        let root = await this.subspace.get(ctx, [collection, SUBSPACE_ROOT]);
        if (!root) {
            return 0;
        } else {
            return this.countNode(ctx, collection, cursor, encoders.int32LE.unpack(root));
        }
    }

    private async countNode(ctx: Context, collection: Buffer, cursor: { from?: number | null, to?: number | null }, nodeId: number): Promise<number> {
        let node = await this.readNode(ctx, collection, nodeId);
        if (node.type === 'leaf') {
            let res = 0;
            for (let n of node.children) {
                if (isWithin(cursor, n)) {
                    res++;
                }
            }
            return res;
        } else if (node.type === 'internal') {
            let res = 0;
            for (let n of node.children) {
                if (isIntervalWithin(cursor, n)) {
                    res += n.count;
                } else {
                    if (isIntersects(cursor, n)) {
                        res += await this.countNode(ctx, collection, cursor, n.node);
                    }
                }
            }
            return res;
        } else {
            throw Error('Invalid type');
        }
    }

    //
    // Debug dumping
    //

    dump = async (ctx: Context, collection: Buffer): Promise<DumpedNode | null> => {
        let root = await this.subspace.get(ctx, [collection, SUBSPACE_ROOT]);
        if (!root) {
            return null;
        } else {
            return await this.dumpNode(ctx, collection, encoders.int32LE.unpack(root));
        }
    }

    private async dumpNode(ctx: Context, collection: Buffer, nodeId: number): Promise<DumpedNode> {
        let node = await this.readNode(ctx, collection, nodeId);
        if (node.type === 'leaf') {
            return {
                type: 'leaf',
                records: node.children
            };
        } else if (node.type === 'internal') {
            return {
                type: 'internal',
                children: await Promise.all(node.children.map(async (ch) => ({ min: ch.min, max: ch.max, count: ch.count, node: await this.dumpNode(ctx, collection, ch.node) })))
            };
        } else {
            throw Error('Unable to dump node');
        }
    }

    //
    // Tree Operations
    //

    private rebalance = async (ctx: Context, collection: Buffer, nodeId: number) => {
        let node = await this.readNode(ctx, collection, nodeId);
        if (node.children.length >= this.maxBranch - 1) {
            await this.splitNode(ctx, collection, node.id);
        }
    }

    private splitNode = async (ctx: Context, collection: Buffer, nodeId: number) => {
        let node = await this.readNode(ctx, collection, nodeId);

        // Resolve new parent
        let parentId: number;
        if (node.parent === null) {
            parentId = await this.allocateNodeId(ctx, collection);
        } else {
            parentId = node.parent;
        }

        // Allocate new node
        let newNodeId = await this.allocateNodeId(ctx, collection);

        let leftCount: number;
        let rightCount: number;
        let leftMin: number;
        let leftMax: number;
        let rightMin: number;
        let rightMax: number;

        if (node.type === 'leaf') {
            let split = arraySplit(node.children);

            // Write left node
            this.writeNode(ctx, collection, {
                ...node,
                parent: parentId,
                children: split.left
            });

            // Write right node
            this.writeNode(ctx, collection, {
                type: 'leaf',
                id: newNodeId,
                parent: parentId,
                children: split.right
            });

            // Resolve left metrics
            leftCount = split.left.length;
            leftMin = split.left[0];
            leftMax = split.left[split.left.length - 1];

            // Resolve right metrics
            rightCount = split.right.length;
            rightMin = split.right[0];
            rightMax = split.right[split.right.length - 1];
        } else if (node.type === 'internal') {
            let split = arraySplit(node.children);

            // Write left node
            this.writeNode(ctx, collection, {
                ...node,
                parent: parentId,
                children: split.left
            });

            // Write right node
            this.writeNode(ctx, collection, {
                type: 'internal',
                id: newNodeId,
                parent: parentId,
                children: split.right
            });

            // Update parent for new items
            for (let l of split.right) {
                await this.updateParent(ctx, collection, l.node, newNodeId);
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
        if (node.parent === null) {
            this.writeRoot(ctx, collection, parentId);
            this.writeNode(ctx, collection, {
                type: 'internal',
                id: parentId,
                parent: null,
                children: [
                    { node: node.id, min: leftMin, max: leftMax, count: leftCount },
                    { node: newNodeId, min: rightMin, max: rightMax, count: rightCount }
                ]
            });
        } else {
            // Load parent node
            let parentNode = await this.readNode(ctx, collection, node.parent);
            if (parentNode.type !== 'internal') {
                throw Error('Broken tree');
            }
            let index = parentNode.children.findIndex((v) => v.node === node.id);
            if (index < 0) {
                throw Error('Broken tree');
            }

            // Insert new children to parent
            let childrenLeft = parentNode.children.slice(0, index);
            let childrenRight = parentNode.children.slice(index + 1);
            let children: { node: number, min: number, max: number, count: number }[] = [
                ...childrenLeft,
                { node: node.id, min: leftMin, max: leftMax, count: leftCount },
                { node: newNodeId, min: rightMin, max: rightMax, count: rightCount },
                ...childrenRight
            ];
            this.writeNode(ctx, collection, {
                type: 'internal',
                id: parentNode.id,
                parent: parentNode.parent,
                children
            });
        }

        // Rebalance parent
        await this.rebalance(ctx, collection, parentId);
    }

    private treeSearch = async (ctx: Context, collection: Buffer, nodeId: number, key: number): Promise<LeafNode> => {
        let nodeRaw = await this.subspace.get(ctx, [collection, SUBSPACE_NODES, nodeId]);
        if (!nodeRaw) {
            throw Error('Unable to find node');
        }
        let node = unpackNode(nodeRaw);
        if (node.type === 'leaf') {
            return node;
        } else if (node.type === 'internal') {
            if (key < node.children[1].min) {
                return this.treeSearch(ctx, collection, node.children[0].node, key);
            } else if (node.children[node.children.length - 1].min <= key) {
                return this.treeSearch(ctx, collection, node.children[node.children.length - 1].node, key);
            } else {
                for (let i = 1; i < node.children.length - 1; i++) {
                    if (node.children[i].min <= key && node.children[i + 1].min < key) {
                        return this.treeSearch(ctx, collection, node.children[i].node, key);
                    }
                }
            }
            throw Error('Invalid node');
        }
        throw Error('Invalid node');
    }

    //
    // Node Operations
    //

    private async allocateNodeId(ctx: Context, collection: Buffer) {
        let counterRaw = await this.subspace.get(ctx, [collection, SUBSPACE_COUNTER]);
        let nodeId = 1;
        if (counterRaw) {
            nodeId = encoders.int32LE.unpack(counterRaw) + 1;
            this.subspace.set(ctx, [collection, SUBSPACE_COUNTER], encoders.int32LE.pack(nodeId));
        } else {
            this.subspace.set(ctx, [collection, SUBSPACE_COUNTER], encoders.int32LE.pack(1));
        }
        return nodeId;
    }

    private async readNode(ctx: Context, collection: Buffer, nodeId: number) {
        let node = await this.subspace.get(ctx, [collection, SUBSPACE_NODES, nodeId]);
        if (!node) {
            throw Error('Unable to find node');
        }
        return unpackNode(node);
    }

    private writeNode(ctx: Context, collection: Buffer, node: Node) {
        this.subspace.set(ctx, [collection, SUBSPACE_NODES, node.id], packNode(node));
    }

    private writeRoot(ctx: Context, collection: Buffer, nodeId: number | null) {
        if (nodeId !== null) {
            this.subspace.set(ctx, [collection, SUBSPACE_ROOT], encoders.int32LE.pack(nodeId));
        } else {
            this.subspace.clear(ctx, [collection, SUBSPACE_ROOT]);
        }
    }

    private async updateParent(ctx: Context, collection: Buffer, nodeId: number, parentId: number) {
        let node = await this.readNode(ctx, collection, nodeId);
        node.parent = parentId;
        this.writeNode(ctx, collection, node);
    }

    private async readRoot(ctx: Context, collection: Buffer): Promise<Node | null> {
        let root = await this.subspace.get(ctx, [collection, SUBSPACE_ROOT]);
        if (!root) {
            return null;
        } else {
            return this.readNode(ctx, collection, encoders.int32LE.unpack(root));
        }
    }

    private async updateCount(ctx: Context, collection: Buffer, nodeId: number, childrenId: number, count: number) {
        let node = await this.readNode(ctx, collection, nodeId);
        if (node.type !== 'internal') {
            throw Error('Node type invalid');
        }
        let index = node.children.findIndex((v) => v.node === childrenId);
        if (index < 0) {
            await delay(100);
            throw Error('Unable to find children');
        }
        node.children[index].count = count;
        this.writeNode(ctx, collection, node);

        if (node.parent !== null) {
            let sum = 0;
            for (let ch of node.children) {
                sum += ch.count;
            }
            await this.updateCount(ctx, collection, node.parent, nodeId, sum);
        }
    }

    private async updateMinMax(ctx: Context, collection: Buffer, nodeId: number, childrenId: number, key: number) {
        let node = await this.readNode(ctx, collection, nodeId);
        if (node.type !== 'internal') {
            throw Error('Node type invalid');
        }
        let index = node.children.findIndex((v) => v.node === childrenId);
        if (index < 0) {
            throw Error('Unable to find children');
        }
        node.children[index].min = Math.min(node.children[index].min, key);
        node.children[index].max = Math.max(node.children[index].max, key);
        this.writeNode(ctx, collection, node);

        if (node.parent !== null) {
            await this.updateMinMax(ctx, collection, node.parent, nodeId, key);
        }
    }
}