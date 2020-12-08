import { Context } from '@openland/context';
import { encoders, getTransaction, Subspace, TransactionCache, TupleItem } from '@openland/foundationdb';
import { TreeHead, TreeNode, TreeNodeType } from './BTree';

type TreeCache = {
    head: {
        root: number,
        nodeCounter: number,
    },
    cache: { [key: number]: TreeNode | null },
    writes: { [key: number]: true }
    writeHead: boolean,
};

const bucketWriteCache = new TransactionCache<TreeCache>('btree-repo');

const SUBSPACE_HEAD = 0;
const SUBSPACE_NODES = 1;

export class BTreeRepository {
    private readonly subspace: Subspace<TupleItem[], Buffer>;

    constructor(subspace: Subspace) {
        this.subspace = subspace.withKeyEncoding(encoders.tuple);
    }

    //
    // Nodes
    //

    async readNode(ctx: Context, collection: Buffer, node: number) {
        let cache = await this.getCache(ctx, collection);
        let cached = cache.cache[node];
        if (cached !== undefined) {
            if (cached === null) {
                throw Error('Unable to find node ' + node);
            }
            return cached;
        }
        let rawNode = await this.subspace.get(ctx, [collection, SUBSPACE_NODES, node]);
        if (!rawNode) {
            throw Error('Unable to find node ' + node);
        }
        let decoded = TreeNode.decode(rawNode);
        cache.cache[node] = decoded;
        return decoded;
    }

    async clearNode(ctx: Context, collection: Buffer, id: number) {
        let cache = await this.getCache(ctx, collection);
        let hadWrites = cache.writeHead || Object.keys(cache.writes).length > 0;
        cache.cache[id] = null;
        cache.writes[id] = true;
        if (!hadWrites) {
            this.registerFlush(ctx, collection, cache);
        }
    }

    async writeNode(ctx: Context, collection: Buffer, node: TreeNode) {
        if (node.type === TreeNodeType.INNER && node.children.length < 2) {
            throw Error('Invalid inner node');
        }
        let cache = await this.getCache(ctx, collection);
        let hadWrites = cache.writeHead || Object.keys(cache.writes).length > 0;
        cache.cache[node.id] = node;
        cache.writes[node.id] = true;
        if (!hadWrites) {
            this.registerFlush(ctx, collection, cache);
        }
    }

    async allocateNodeId(ctx: Context, collection: Buffer) {
        let cache = await this.getCache(ctx, collection);
        let id = ++cache.head.nodeCounter;
        this.flushHead(ctx, collection, cache);
        return id;
    }

    async getRoot(ctx: Context, collection: Buffer) {
        let cache = await this.getCache(ctx, collection);
        if (cache.head.root > 0) {
            return cache.head.root;
        } else {
            return null;
        }
    }

    async setRoot(ctx: Context, collection: Buffer, node: number | null) {
        let cache = await this.getCache(ctx, collection);
        if (node === null) {
            cache.head.root = 0;
        } else {
            cache.head.root = node;
        }
        this.flushHead(ctx, collection, cache);
    }

    //
    // Cache operations
    //

    private flushHead(ctx: Context, collection: Buffer, cache: TreeCache) {
        if (!cache.writeHead) {
            cache.writeHead = true;

            // If not already flushed
            if (Object.keys(cache.writes).length === 0) {
                this.registerFlush(ctx, collection, cache);
            }
        }
    }

    private registerFlush(ctx: Context, collection: Buffer, cache: TreeCache) {
        getTransaction(ctx).beforeCommit((commit) => {

            // Flush head
            if (cache.writeHead) {
                this.subspace.set(commit, [collection, SUBSPACE_HEAD], Buffer.from(TreeHead.encode({ root: cache.head.root, counter: cache.head.nodeCounter }).finish()));
            }

            // Flush nodes
            for (let key in cache.writes) {
                let id = parseInt(key, 10);
                if (cache.cache[id]) {
                    this.subspace.set(commit, [collection, SUBSPACE_NODES, id], Buffer.from(TreeNode.encode(cache.cache[id]!).finish()));
                } else {
                    this.subspace.clear(commit, [collection, SUBSPACE_NODES, id]);
                }
            }
        });
    }

    private async getCache(ctx: Context, collection: Buffer) {
        let key = 'cache-' + collection.toString('hex');
        let existing = bucketWriteCache.get(ctx, key);
        if (!existing) {
            let headRaw = await this.subspace.get(ctx, [collection, SUBSPACE_HEAD]);
            if (!headRaw) {
                existing = { head: { nodeCounter: 1, root: 0 }, writeHead: false, cache: {}, writes: {} };
                bucketWriteCache.set(ctx, key, existing);
            } else {
                let decoded = TreeHead.decode(headRaw);
                existing = { head: { nodeCounter: decoded.counter, root: decoded.root }, writeHead: false, cache: {}, writes: {} };
                bucketWriteCache.set(ctx, key, existing);
            }
        }
        return existing;
    }
}