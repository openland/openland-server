import { createNamedContext } from '@openland/context';
import { inTx, Database } from '@openland/foundationdb';
import { BPlusTreeDirectory } from './BPlusTreeDirectory';

let root = createNamedContext('test');
const COLLECTION_0 = Buffer.from([0]);
const COLLECTION_1 = Buffer.from([1]);
const COLLECTION_2 = Buffer.from([2]);
const COLLECTION_3 = Buffer.from([3]);
const COLLECTION_4 = Buffer.from([4]);
const COLLECTION_5 = Buffer.from([5]);
const COLLECTION_6 = Buffer.from([6]);
const COLLECTION_7 = Buffer.from([7]);
const COLLECTION_8 = Buffer.from([8]);

describe('BPlusTreeDirectory', () => {

    let directory: BPlusTreeDirectory;
    beforeAll(async () => {
        let db = await Database.openTest({ name: 'bplustree-directory', layers: [] });
        directory = new BPlusTreeDirectory(db.allKeys, 5);
    });

    it('should create root node', async () => {
        await inTx(root, async (ctx) => {
            await directory.add(ctx, COLLECTION_0, 1);
        });

        let dump = await inTx(root, async (ctx) => {
            return await directory.ops.dumpAll(ctx, COLLECTION_0);
        });
        expect(dump).toMatchSnapshot();
    });

    it('should create delete root node', async () => {
        await inTx(root, async (ctx) => {
            await directory.add(ctx, COLLECTION_6, 1);
        });
        await inTx(root, async (ctx) => {
            await directory.remove(ctx, COLLECTION_6, 1);
        });
        let dump = await inTx(root, async (ctx) => {
            return await directory.ops.dumpAll(ctx, COLLECTION_6);
        });
        expect(dump).toBeNull();
    });

    it('should expand root node', async () => {
        await inTx(root, async (ctx) => {
            await directory.add(ctx, COLLECTION_1, 2);
            await directory.add(ctx, COLLECTION_1, 10);
            await directory.add(ctx, COLLECTION_1, 1);
        });

        let dump = await inTx(root, async (ctx) => {
            return await directory.ops.dumpAll(ctx, COLLECTION_1);
        });
        expect(dump).toMatchSnapshot();
    });

    it('should shrink root node', async () => {
        await inTx(root, async (ctx) => {
            await directory.add(ctx, COLLECTION_7, 2);
            await directory.add(ctx, COLLECTION_7, 10);
            await directory.add(ctx, COLLECTION_7, 1);
            await directory.remove(ctx, COLLECTION_7, 1);
        });
        let dump = await inTx(root, async (ctx) => {
            return await directory.ops.dumpAll(ctx, COLLECTION_7);
        });
        expect(dump).toMatchSnapshot();

        await inTx(root, async (ctx) => {
            await directory.remove(ctx, COLLECTION_7, 10);
        });
        dump = await inTx(root, async (ctx) => {
            return await directory.ops.dumpAll(ctx, COLLECTION_7);
        });
        expect(dump).toMatchSnapshot();

        await inTx(root, async (ctx) => {
            await directory.remove(ctx, COLLECTION_7, 2);
        });
        dump = await inTx(root, async (ctx) => {
            return await directory.ops.dumpAll(ctx, COLLECTION_7);
        });
        expect(dump).toMatchSnapshot();
    });

    it('should split root node', async () => {
        await inTx(root, async (ctx) => {
            await directory.add(ctx, COLLECTION_2, 1);
            await directory.add(ctx, COLLECTION_2, 10);
            await directory.add(ctx, COLLECTION_2, 5);
            await directory.add(ctx, COLLECTION_2, 11);
            await directory.add(ctx, COLLECTION_2, 12);
        });

        let dump = await inTx(root, async (ctx) => {
            return await directory.ops.dumpAll(ctx, COLLECTION_2);
        });
        expect(dump).toMatchSnapshot();
    });

    it('should shrink splitted root node', async () => {
        await inTx(root, async (ctx) => {
            await directory.add(ctx, COLLECTION_8, 1);
            await directory.add(ctx, COLLECTION_8, 10);
            await directory.add(ctx, COLLECTION_8, 5);
            await directory.add(ctx, COLLECTION_8, 11);
            await directory.add(ctx, COLLECTION_8, 12);
        });

        let dump = await inTx(root, async (ctx) => {
            await directory.remove(ctx, COLLECTION_8, 1);
            return await directory.ops.dumpAll(ctx, COLLECTION_8);
        });
        expect(dump).toMatchSnapshot();

        dump = await inTx(root, async (ctx) => {
            await directory.remove(ctx, COLLECTION_8, 10);
            return await directory.ops.dumpAll(ctx, COLLECTION_8);
        });
        expect(dump).toMatchSnapshot();

        dump = await inTx(root, async (ctx) => {
            await directory.remove(ctx, COLLECTION_8, 5);
            return await directory.ops.dumpAll(ctx, COLLECTION_8);
        });
        expect(dump).toMatchSnapshot();
        
    });

    it('should split root internal node', async () => {
        await inTx(root, async (ctx) => {
            await directory.add(ctx, COLLECTION_3, 1);
            await directory.add(ctx, COLLECTION_3, 10);
            await directory.add(ctx, COLLECTION_3, 5);
            await directory.add(ctx, COLLECTION_3, 11);
        });

        await inTx(root, async (ctx) => {
            await directory.add(ctx, COLLECTION_3, 12);
            await directory.add(ctx, COLLECTION_3, 145);
            await directory.add(ctx, COLLECTION_3, 113);
            await directory.add(ctx, COLLECTION_3, -1);
        });

        let dump = await inTx(root, async (ctx) => {
            return await directory.ops.dumpAll(ctx, COLLECTION_3);
        });
        expect(dump).toMatchSnapshot();
    });

    it('should split internal node', async () => {
        await inTx(root, async (ctx) => {
            await directory.add(ctx, COLLECTION_4, 1);
            await directory.add(ctx, COLLECTION_4, 10);
            await directory.add(ctx, COLLECTION_4, 5);
            await directory.add(ctx, COLLECTION_4, 11);
        });

        await inTx(root, async (ctx) => {
            await directory.add(ctx, COLLECTION_4, 12);
            await directory.add(ctx, COLLECTION_4, 145);
            await directory.add(ctx, COLLECTION_4, 113);
            await directory.add(ctx, COLLECTION_4, -1);
            await directory.add(ctx, COLLECTION_4, 114);
            await directory.add(ctx, COLLECTION_4, 115);
            await directory.add(ctx, COLLECTION_4, 118);
            await directory.add(ctx, COLLECTION_4, 119);
        });

        let dump = await inTx(root, async (ctx) => {
            return await directory.ops.dumpAll(ctx, COLLECTION_4);
        });
        expect(dump).toMatchSnapshot();
    });

    it('should count', async () => {
        await inTx(root, async (ctx) => {
            for (let i = 0; i < 100; i++) {
                await directory.add(ctx, COLLECTION_5, i);
            }
        });

        let count = await inTx(root, async (ctx) => {
            let res = await directory.count(ctx, COLLECTION_5, { from: 43, to: 60 });
            return { res };
        });
        expect(count.res).toBe(18);
    });
});