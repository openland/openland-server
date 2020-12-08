import { createNamedContext } from '@openland/context';
import { inTx, Database } from '@openland/foundationdb';
import { TreeNodeType } from './BTree';
import { BTreeRepository } from './BTreeRepository';
import { BTreeOperations } from './BTreeOperations';

const COLLECTION_0 = Buffer.from([0]);
const COLLECTION_1 = Buffer.from([1]);
const COLLECTION_2 = Buffer.from([2]);
const COLLECTION_3 = Buffer.from([3]);
const COLLECTION_4 = Buffer.from([4]);
const COLLECTION_5 = Buffer.from([5]);
const COLLECTION_6 = Buffer.from([6]);

describe('BTreeOperations', () => {
    let db: Database;
    let root = createNamedContext('test');
    let ops: BTreeOperations;

    beforeAll(async () => {
        db = await Database.openTest({ name: 'bplustree-directory-ops', layers: [] });
        ops = new BTreeOperations(new BTreeRepository(db.allKeys));
    });

    it('should create and delete root node', async () => {
        let dump = await inTx(root, async (ctx) => {
            await ops.setRootNode(ctx, COLLECTION_0, { id: 1, type: TreeNodeType.LEAF, values: [1, 2, 3, 4] });
            return await ops.dumpAll(ctx, COLLECTION_0);
        });
        expect(dump).toMatchSnapshot();

        dump = await inTx(root, async (ctx) => {
            await ops.removeValuesFromLeaf(ctx, COLLECTION_0, 1, [1, 3]);
            return await ops.dumpAll(ctx, COLLECTION_0);
        });
        expect(dump).toMatchSnapshot();
    });

    it('should split root node', async () => {
        await inTx(root, async (ctx) => {
            await ops.setRootNode(ctx, COLLECTION_1, { id: 1, type: TreeNodeType.LEAF, values: [1, 2, 3, 4] });
        });

        let dump = await inTx(root, async (ctx) => {
            await ops.splitNode(ctx, COLLECTION_1, 1);
            return await ops.dumpAll(ctx, COLLECTION_1);
        });
        expect(dump).toMatchSnapshot();

        dump = await inTx(root, async (ctx) => {
            await ops.splitNode(ctx, COLLECTION_1, 1);
            return await ops.dumpAll(ctx, COLLECTION_1);
        });
        expect(dump).toMatchSnapshot();

        dump = await inTx(root, async (ctx) => {
            await ops.splitNode(ctx, COLLECTION_1, 3);
            return await ops.dumpAll(ctx, COLLECTION_1);
        });
        expect(dump).toMatchSnapshot();

        dump = await inTx(root, async (ctx) => {
            await ops.splitNode(ctx, COLLECTION_1, 2);
            return await ops.dumpAll(ctx, COLLECTION_1);
        });
        expect(dump).toMatchSnapshot();
    });

    it('should find node', async () => {
        await inTx(root, async (ctx) => {
            await ops.setRootNode(ctx, COLLECTION_2, { id: 1, type: TreeNodeType.LEAF, values: [1, 2, 3, 4, 5, 6, 7, 8] });
            await ops.splitNode(ctx, COLLECTION_2, 1);
            await ops.splitNode(ctx, COLLECTION_2, 1);
            await ops.splitNode(ctx, COLLECTION_2, 3);
            await ops.splitNode(ctx, COLLECTION_2, 2);
        });

        await inTx(root, async (ctx) => {
            expect((await ops.search(ctx, COLLECTION_2, 1)).id).toBe(1);
            expect((await ops.search(ctx, COLLECTION_2, 2)).id).toBe(1);
            expect((await ops.search(ctx, COLLECTION_2, 3)).id).toBe(4);
            expect((await ops.search(ctx, COLLECTION_2, 4)).id).toBe(4);
            expect((await ops.search(ctx, COLLECTION_2, 5)).id).toBe(3);
            expect((await ops.search(ctx, COLLECTION_2, 6)).id).toBe(3);
            expect((await ops.search(ctx, COLLECTION_2, 7)).id).toBe(5);
            expect((await ops.search(ctx, COLLECTION_2, 8)).id).toBe(5);

            expect((await ops.findNodeSiblingLeft(ctx, COLLECTION_2, 1))).toBeNull();
            expect((await ops.findNodeSiblingRight(ctx, COLLECTION_2, 1))).toBe(4);
            expect((await ops.findNodeSiblingLeft(ctx, COLLECTION_2, 4))).toBe(1);
            expect((await ops.findNodeSiblingRight(ctx, COLLECTION_2, 4))).toBe(3);
            expect((await ops.findNodeSiblingLeft(ctx, COLLECTION_2, 3))).toBe(4);
            expect((await ops.findNodeSiblingRight(ctx, COLLECTION_2, 3))).toBe(5);
            expect((await ops.findNodeSiblingLeft(ctx, COLLECTION_2, 5))).toBe(3);
            expect((await ops.findNodeSiblingRight(ctx, COLLECTION_2, 5))).toBeNull();
        });
    });

    it('should insert to leaf', async () => {
        await inTx(root, async (ctx) => {
            await ops.setRootNode(ctx, COLLECTION_3, { id: 1, type: TreeNodeType.LEAF, values: [1, 2, 3, 4, 5, 6, 7, 8] });
            await ops.splitNode(ctx, COLLECTION_3, 1);
            await ops.splitNode(ctx, COLLECTION_3, 1);
            await ops.splitNode(ctx, COLLECTION_3, 3);
        });

        let dump = await inTx(root, async (ctx) => {
            await ops.addValuesToLeaf(ctx, COLLECTION_3, 1, [0, -1]);
            await ops.addValuesToLeaf(ctx, COLLECTION_3, 5, [10, 9]);
            return ops.dumpAll(ctx, COLLECTION_3);
        });
        expect(dump).toMatchSnapshot();
    });

    it('should delete node', async () => {
        await inTx(root, async (ctx) => {
            await ops.setRootNode(ctx, COLLECTION_4, { id: 1, type: TreeNodeType.LEAF, values: [1, 2, 3, 4, 5, 6, 7, 8] });
            await ops.splitNode(ctx, COLLECTION_4, 1);
            await ops.splitNode(ctx, COLLECTION_4, 1);
            await ops.splitNode(ctx, COLLECTION_4, 3);
        });

        let dump = await inTx(root, async (ctx) => {
            await ops.deleteNode(ctx, COLLECTION_4, 1);
            return ops.dumpAll(ctx, COLLECTION_4);
        });
        expect(dump).toMatchSnapshot();
    });

    it('should move value', async () => {
        await inTx(root, async (ctx) => {
            await ops.setRootNode(ctx, COLLECTION_5, { id: 1, type: TreeNodeType.LEAF, values: [1, 2, 3, 4] });
            await ops.splitNode(ctx, COLLECTION_5, 1);
        });

        let dump = await inTx(root, async (ctx) => {
            await ops.moveValue(ctx, COLLECTION_5, 1, 3, 2);
            return ops.dumpAll(ctx, COLLECTION_5);
        });
        expect(dump).toMatchSnapshot();

        dump = await inTx(root, async (ctx) => {
            await ops.moveValue(ctx, COLLECTION_5, 3, 1, 2);
            await ops.moveValue(ctx, COLLECTION_5, 3, 1, 3);
            return ops.dumpAll(ctx, COLLECTION_5);
        });
        expect(dump).toMatchSnapshot();
    });

    it('should move node', async () => {
        let dump = await inTx(root, async (ctx) => {
            await ops.setRootNode(ctx, COLLECTION_6, { id: 1, type: TreeNodeType.LEAF, values: [1, 2, 3, 4, 5, 6, 7, 8] });
            await ops.splitNode(ctx, COLLECTION_6, 1);
            await ops.splitNode(ctx, COLLECTION_6, 1);
            await ops.splitNode(ctx, COLLECTION_6, 3);
            await ops.splitNode(ctx, COLLECTION_6, 2);
            return ops.dumpAll(ctx, COLLECTION_6);
        });
        expect(dump).toMatchSnapshot();

        dump = await inTx(root, async (ctx) => {
            await ops.moveNode(ctx, COLLECTION_6, 4, 7);
            return ops.dumpAll(ctx, COLLECTION_6);
        });
        expect(dump).toMatchSnapshot();
    });
});