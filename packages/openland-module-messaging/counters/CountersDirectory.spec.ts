import { createNamedContext } from '@openland/context';
import { Database, inTx } from '@openland/foundationdb';
import { CountersDirectory } from './CountersDirectory';

let root = createNamedContext('test');

describe('CountersDirectory', () => {
    let repo: CountersDirectory;
    beforeAll(async () => {
        let db = await Database.openTest({ layers: [] });
        repo = new CountersDirectory(db.allKeys);
    });

    it('should count items', async () => {

        await inTx(root, async (ctx) => {
            await repo.addOrUpdateMessage(ctx, [1], 1, { mentions: [], allMention: false, sender: 1, visibleOnlyTo: [] });
            await repo.addOrUpdateMessage(ctx, [1], 2, { mentions: [], allMention: true, sender: 1, visibleOnlyTo: [] });
            await repo.addOrUpdateMessage(ctx, [1], 3, { mentions: [], allMention: false, sender: 1, visibleOnlyTo: [] });
            await repo.addOrUpdateMessage(ctx, [1], 4, { mentions: [2, 2], allMention: true, sender: 1, visibleOnlyTo: [] });
            await repo.addOrUpdateMessage(ctx, [1], 5, { mentions: [2], allMention: false, sender: 1, visibleOnlyTo: [] });
            await repo.addOrUpdateMessage(ctx, [1], 6, { mentions: [], allMention: false, sender: 1, visibleOnlyTo: [] });
        });

        await inTx(root, async (ctx) => {
            let counted = await repo.count(ctx, [1], 1, 0);
            expect(counted.unread).toBe(0);
            expect(counted.unreadMentions).toBe(0);

            counted = await repo.count(ctx, [1], 2, 0);
            expect(counted.unread).toBe(6);
            expect(counted.unreadMentions).toBe(3);

            counted = await repo.count(ctx, [1], 2, 3);
            expect(counted.unread).toBe(3);
            expect(counted.unreadMentions).toBe(2);
        });

        await inTx(root, async (ctx) => {
            await repo.addOrUpdateMessage(ctx, [1], 6, { mentions: [], allMention: true, sender: 1, visibleOnlyTo: [] });
            let counted = await repo.count(ctx, [1], 2, 3);
            expect(counted.unread).toBe(3);
            expect(counted.unreadMentions).toBe(3);
            await repo.addOrUpdateMessage(ctx, [1], 6, { mentions: [], allMention: false, sender: 1, visibleOnlyTo: [] });
            counted = await repo.count(ctx, [1], 2, 3);
            expect(counted.unread).toBe(3);
            expect(counted.unreadMentions).toBe(2);
        });

        await inTx(root, async (ctx) => {
            await repo.removeMessage(ctx, [1], 6);
            await repo.removeMessage(ctx, [1], 6);
            let counted = await repo.count(ctx, [1], 2, 3);
            expect(counted.unread).toBe(2);
            expect(counted.unreadMentions).toBe(2);
        });

        await inTx(root, async (ctx) => {
            await repo.removeMessage(ctx, [1], 6);
            let counted = await repo.count(ctx, [1], 2, 3);
            expect(counted.unread).toBe(2);
            expect(counted.unreadMentions).toBe(2);
        });
    });

    it('should count visibleOnlyTo correctly', async () => {
        await inTx(root, async (ctx) => {
            await repo.addOrUpdateMessage(ctx, [2], 1, { mentions: [], allMention: false, sender: 1, visibleOnlyTo: [2] });
            await repo.addOrUpdateMessage(ctx, [2], 2, { mentions: [], allMention: true, sender: 1, visibleOnlyTo: [] });
            await repo.addOrUpdateMessage(ctx, [2], 3, { mentions: [2], allMention: false, sender: 1, visibleOnlyTo: [1] });
            await repo.addOrUpdateMessage(ctx, [2], 4, { mentions: [2, 2], allMention: true, sender: 1, visibleOnlyTo: [2, 2, 2, 1] });
            await repo.addOrUpdateMessage(ctx, [2], 5, { mentions: [2], allMention: false, sender: 1, visibleOnlyTo: [2] });
            await repo.addOrUpdateMessage(ctx, [2], 6, { mentions: [], allMention: false, sender: 1, visibleOnlyTo: [] });
        });

        await inTx(root, async (ctx) => {
            let counted = await repo.count(ctx, [2], 2, 0);
            expect(counted.unread).toBe(5);
            expect(counted.unreadMentions).toBe(3);

            counted = await repo.count(ctx, [2], 3, 0);
            expect(counted.unread).toBe(2);
            expect(counted.unreadMentions).toBe(1);
        });

        await inTx(root, async (ctx) => {
            await repo.removeMessage(ctx, [2], 6);

            let counted = await repo.count(ctx, [2], 2, 0);
            expect(counted.unread).toBe(4);
            expect(counted.unreadMentions).toBe(3);

            counted = await repo.count(ctx, [2], 3, 0);
            expect(counted.unread).toBe(1);
            expect(counted.unreadMentions).toBe(1);
        });
    });
});