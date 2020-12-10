import { createNamedContext } from '@openland/context';
import { Database, inTx } from '@openland/foundationdb';
import { HybridCountersRepository } from './HybridCountersRepository';

let root = createNamedContext('test');

describe('HybridCountersRepository', () => {
    let repo: HybridCountersRepository;
    beforeAll(async () => {
        let db = await Database.openTest({ name: 'counters-hybrid-repository', layers: [] });
        repo = new HybridCountersRepository(db.allKeys);
    });

    it('should count items', async () => {

        await inTx(root, async (ctx) => {
            await repo.addOrUpdateMessage(ctx, [1], 1, { mentions: [], allMention: false, sender: 1 });
            await repo.addOrUpdateMessage(ctx, [1], 2, { mentions: [], allMention: true, sender: 1 });
            await repo.addOrUpdateMessage(ctx, [1], 3, { mentions: [], allMention: false, sender: 1 });
            await repo.addOrUpdateMessage(ctx, [1], 4, { mentions: [2], allMention: true, sender: 1 });
            await repo.addOrUpdateMessage(ctx, [1], 5, { mentions: [2], allMention: false, sender: 1 });
            await repo.addOrUpdateMessage(ctx, [1], 6, { mentions: [], allMention: false, sender: 1 });
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
            await repo.addOrUpdateMessage(ctx, [1], 6, { mentions: [], allMention: true, sender: 1 });
            let counted = await repo.count(ctx, [1], 2, 3);
            expect(counted.unread).toBe(3);
            expect(counted.unreadMentions).toBe(3);
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
});