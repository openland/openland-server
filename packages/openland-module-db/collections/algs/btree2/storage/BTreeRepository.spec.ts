import { createNamedContext } from '@openland/context';
import { inTx, Database } from '@openland/foundationdb';
import { TreeNode, TreeNodeType } from '../../../../structs';
import { BTreeRepository } from './BTreeRepository';

const COLLECTION_0 = Buffer.from([0]);
const COLLECTION_1 = Buffer.from([1]);

describe('BTreeRepository', () => {
    let db: Database;
    let root = createNamedContext('test');

    beforeAll(async () => {
        db = await Database.openTest({ name: 'bplustree-directory', layers: [] });
    });

    it('should persist head', async () => {
        let repo = new BTreeRepository(db.allKeys);
        await inTx(root, async (ctx) => {
            expect(await repo.getRoot(ctx, COLLECTION_0)).toBeNull();
            await repo.setRoot(ctx, COLLECTION_0, 10);
            expect(await repo.getRoot(ctx, COLLECTION_0)).toBe(10);
        });

        await inTx(root, async (ctx) => {
            expect(await repo.getRoot(ctx, COLLECTION_0)).toBe(10);
        });
    });

    it('should persist nodes', async () => {
        let repo = new BTreeRepository(db.allKeys);
        await inTx(root, async (ctx) => {
            await repo.writeNode(ctx, COLLECTION_1, new TreeNode({ id: 1, type: TreeNodeType.LEAF, values: [1, 2, 3, 4] }));
            let node = await repo.readNode(ctx, COLLECTION_1, 1);
            expect(node.id).toBe(1);
            expect(node.values).toMatchObject([1, 2, 3, 4]);
            expect(node.type).toBe(TreeNodeType.LEAF);
        });

        await inTx(root, async (ctx) => {
            let node = await repo.readNode(ctx, COLLECTION_1, 1);
            expect(node.id).toBe(1);
            expect(node.values).toMatchObject([1, 2, 3, 4]);
            expect(node.type).toBe(TreeNodeType.LEAF);
        });
    });
});