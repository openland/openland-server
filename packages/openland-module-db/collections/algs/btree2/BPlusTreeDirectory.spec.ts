import { createNamedContext } from '@openland/context';
import { inTx, Database } from '@openland/foundationdb';
import { BPlusTreeDirectory, DumpedNode } from './BPlusTreeDirectory';

let root = createNamedContext('test');
const COLLECTION_0 = Buffer.from([0]);
const COLLECTION_1 = Buffer.from([1]);
const COLLECTION_2 = Buffer.from([2]);
const COLLECTION_3 = Buffer.from([3]);
const COLLECTION_4 = Buffer.from([4]);
const COLLECTION_5 = Buffer.from([5]);

function expectDumpToMatch(src: DumpedNode | null, dst: DumpedNode) {
    expect(src).toMatchObject(dst);
}

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
            return await directory.dump(ctx, COLLECTION_0);
        });
        expectDumpToMatch(dump, {
            type: 'leaf',
            records: [1]
        });

        // await inTx(root, async (ctx) => {
        //     await directory.remove(ctx, COLLECTION_0, 1);
        // });

        // dump = await inTx(root, async (ctx) => {
        //     return await directory.dump(ctx, COLLECTION_0);
        // });
        // expect(dump).toBeNull();
    });

    it('should expand root node', async () => {
        await inTx(root, async (ctx) => {
            await directory.add(ctx, COLLECTION_1, 2);
            await directory.add(ctx, COLLECTION_1, 10);
            await directory.add(ctx, COLLECTION_1, 1);
        });

        let dump = await inTx(root, async (ctx) => {
            return await directory.dump(ctx, COLLECTION_1);
        });
        expectDumpToMatch(dump, {
            type: 'leaf',
            records: [1, 2, 10]
        });

        // await inTx(root, async (ctx) => {
        //     await directory.remove(ctx, COLLECTION_1, 1);
        // });
        // dump = await inTx(root, async (ctx) => {
        //     return await directory.dump(ctx, COLLECTION_1);
        // });
        // expectDumpToMatch(dump, {
        //     type: 'leaf',
        //     records: [2, 10]
        // });

        // await inTx(root, async (ctx) => {
        //     await directory.remove(ctx, COLLECTION_1, 10);
        // });
        // dump = await inTx(root, async (ctx) => {
        //     return await directory.dump(ctx, COLLECTION_1);
        // });
        // expectDumpToMatch(dump, {
        //     type: 'leaf',
        //     records: [2]
        // });
    });

    it('should split root node', async () => {
        await inTx(root, async (ctx) => {
            await directory.add(ctx, COLLECTION_2, 1);
            await directory.add(ctx, COLLECTION_2, 10);
            await directory.add(ctx, COLLECTION_2, 5);
            await directory.add(ctx, COLLECTION_2, 11);
        });

        let dump = await inTx(root, async (ctx) => {
            return await directory.dump(ctx, COLLECTION_2);
        });
        expectDumpToMatch(dump, {
            type: 'internal',
            children: [{
                min: 1,
                max: 5,
                count: 2,
                node: {
                    type: 'leaf',
                    records: [1, 5]
                }
            }, {
                min: 10,
                max: 11,
                count: 2,
                node: {
                    type: 'leaf',
                    records: [10, 11]
                }
            }]
        });
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
            return await directory.dump(ctx, COLLECTION_3);
        });
        expectDumpToMatch(dump, {
            type: 'internal',
            children: [{
                min: -1,
                max: 5,
                count: 3,
                node: {
                    type: 'leaf',
                    records: [-1, 1, 5],
                }
            }, {
                min: 10,
                max: 11,
                count: 2,
                node: {
                    type: 'leaf',
                    records: [10, 11]
                }
            }, {
                min: 12,
                max: 145,
                count: 3,
                node: {
                    type: 'leaf',
                    records: [12, 113, 145]
                }
            }]
        });
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
            return await directory.dump(ctx, COLLECTION_4);
        });
        expectDumpToMatch(dump, {
            type: 'internal',
            children: [{
                min: -1,
                max: 11,
                count: 5,
                node: {
                    type: 'internal',
                    children: [{
                        min: -1,
                        max: 5,
                        count: 3,
                        node: {
                            type: 'leaf',
                            records: [-1, 1, 5]
                        }
                    },
                    {
                        min: 10,
                        max: 11,
                        count: 2,
                        node: {
                            type: 'leaf',
                            records: [10, 11]
                        }
                    }]
                }
            }, {
                min: 12,
                max: 145,
                count: 7,
                node: {
                    type: 'internal',
                    children: [{
                        min: 12,
                        max: 113,
                        count: 2,
                        node: {
                            type: 'leaf',
                            records: [12, 113]
                        }
                    }, {
                        min: 114,
                        max: 115,
                        count: 2,
                        node: {
                            type: 'leaf',
                            records: [114, 115]
                        }
                    }, {
                        min: 118,
                        max: 145,
                        count: 3,
                        node: {
                            type: 'leaf',
                            records: [118, 119, 145]
                        }
                    }]
                }
            }]
        });
    });

    it('should count', async () => {
        await inTx(root, async (ctx) => {
            for (let i = 0; i < 100; i++) {
                await directory.add(ctx, COLLECTION_5, i);
            }
        });

        let count = await inTx(root, async (ctx) => {
            let res = await directory.count(ctx, COLLECTION_5, { from: 43, to: 60 });
            let dump = await directory.dump(ctx, COLLECTION_5);
            return { res, dump };
        });
        expect(count.res).toBe(18);
    });
});