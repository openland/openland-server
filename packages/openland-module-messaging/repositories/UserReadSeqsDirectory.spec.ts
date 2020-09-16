import { testEnvironmentStart } from '../../openland-modules/testEnvironment';
import { createNamedContext } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { UserReadSeqsDirectory } from './UserReadSeqsDirectory';
import { Store } from '../../openland-module-db/FDB';

describe('UserReadSeqsDirectory', () => {
    beforeAll(async () => {
        await testEnvironmentStart('user-read-seqs-directory');
    });

    it('should add and remove dialogs', async () => {
        let root = createNamedContext('test');

        let dir = new UserReadSeqsDirectory();

        // Add dialogs
        await inTx(root, async (ctx) => {
            await Store.ConversationLastSeq.byId(1).set(ctx, 1);
            await Store.ConversationLastSeq.byId(2).set(ctx, 2);
            await Store.ConversationLastSeq.byId(3).set(ctx, 3);
            await Store.ConversationLastSeq.byId(4).set(ctx, 4);

            await dir.onAddDialog(ctx, 1, 1);
            await dir.onAddDialog(ctx, 1, 2);
            await dir.onAddDialog(ctx, 1, 3);
            await dir.onAddDialog(ctx, 1, 4);
        });

        await inTx(root, async ctx => {
            let res = await dir.getUserReadSeqs(ctx, 1);
            expect(res).toEqual([
                { cid: 1, seq: 1 },
                { cid: 2, seq: 2 },
                { cid: 3, seq: 3 },
                { cid: 4, seq: 4 },
            ]);
        });

        // Remove dialogs
        await inTx(root, async ctx => {
            dir.onRemoveDialog(ctx, 1, 1);
            dir.onRemoveDialog(ctx, 1, 2);
            dir.onRemoveDialog(ctx, 1, 3);
            dir.onRemoveDialog(ctx, 1, 4);
        });

        await inTx(root, async ctx => {
            let res = await dir.getUserReadSeqs(ctx, 1);
            expect(res).toEqual([]);
        });
    });

    it('should update seq', async () => {
        let root = createNamedContext('test');

        let dir = new UserReadSeqsDirectory();

        await inTx(root, async (ctx) => {
            await Store.ConversationLastSeq.byId(1).set(ctx, 1);
            await dir.onAddDialog(ctx, 1, 1);
            await dir.updateReadSeq(ctx, 1, 1, 100);
        });

        await inTx(root, async ctx => {
            let res = await dir.getUserReadSeqs(ctx, 1);
            expect(res).toEqual([{ cid: 1, seq: 100 }]);
        });
    });
});