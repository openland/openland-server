import { FeedSeqRepository } from './FeedSeqRepository';
import { randomId } from 'openland-utils/randomId';
import { createNamedContext } from '@openland/context';
import { Database, inTx } from '@openland/foundationdb';

describe('FeedSeqRepository', () => {
    it('should generate seq numbers', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-feed-seq', layers: [] });
        let repo = new FeedSeqRepository(db.allKeys);
        let feed = randomId();

        await inTx(root, async (ctx) => {

            // Initial
            repo.setSeq(ctx, feed, 0);
            expect(await repo.getSeq(ctx, feed)).toBe(0);

            // Ovewrite
            repo.setSeq(ctx, feed, 1);
            expect(await repo.getSeq(ctx, feed)).toBe(1);

            // Allocate
            let allocated = await repo.allocateSeq(ctx, feed);
            expect(allocated).toBe(2);
            expect(await repo.getSeq(ctx, feed)).toBe(2);

            // Allocate
            allocated = await repo.allocateSeq(ctx, feed);
            expect(allocated).toBe(3);
            expect(await repo.getSeq(ctx, feed)).toBe(3);
        });
    });
});