import { testEnvironmentStart } from '../../openland-modules/testEnvironment';
import { createNamedContext } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';
import { CompactMessagesDirectory } from './CompactMessagesDirectory';

describe('CompactMessagesDirectory', () => {
    beforeAll(async () => {
        await testEnvironmentStart('compact-messages-directory');
    });
    it('should add messages', async () => {
        let root = createNamedContext('test');
        let directory = await inTx(root, async (ctx) => {
            return await Store.storage.db.directories.createOrOpen(ctx, ['test']);
        });

        let dir = new CompactMessagesDirectory(directory, 10);

        // Write
        await inTx(root, async (ctx) => {
            await dir.add(ctx, 0, { seq: 1, uid: 1, hiddenFor: [1], mentions: [2]});
            await dir.add(ctx, 0, { seq: 2, uid: 1, hiddenFor: [], mentions: []});
            await dir.add(ctx, 0, { seq: 3, uid: 1, hiddenFor: [], mentions: []});
            await dir.add(ctx, 0, { seq: 4, uid: 1, hiddenFor: [], mentions: []});
            await dir.add(ctx, 0, { seq: 5, uid: 1, hiddenFor: [], mentions: []});
        });

        await inTx(root, async ctx => {
            let res = await dir.get(ctx, 0, 0);
            expect(res.length).toBe(5);
            expect(res[0].hiddenFor[0]).toBe(1);
            expect(res[0].mentions[0]).toBe(2);
        });
    });
});