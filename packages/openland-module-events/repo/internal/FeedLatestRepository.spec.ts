import { FeedSeqRepository } from './FeedSeqRepository';
import { randomId } from 'openland-utils/randomId';
import { VersionStampRepository } from './VersionStampRepository';
import { createNamedContext } from '@openland/context';
import { Database, inTx } from '@openland/foundationdb';
import { FeedLatestRepository } from './FeedLatestRepository';

describe('FeedLatestRepository', () => {
    it('should track latest values', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-feed-latest', layers: [] });
        let repo = new FeedLatestRepository(db.allKeys);
        let seqs = new FeedSeqRepository(db.allKeys);
        let vt = new VersionStampRepository(db);
        let feed = randomId();

        let res = await inTx(root, async (ctx) => {

            // Initial should be null
            let initial = await repo.readFirstTransactionLatest(ctx, feed);
            expect(initial).toBeNull();

            // Write latest
            seqs.setSeq(ctx, feed, 0);
            let seq = await seqs.allocateSeq(ctx, feed);
            let index = vt.allocateVersionstampIndex(ctx);
            await repo.writeLatest(ctx, feed, seq, index);

            // Initial read should still work as expected
            initial = await repo.readFirstTransactionLatest(ctx, feed);
            expect(initial).toBeNull();

            return { id: vt.resolveVersionstamp(ctx, index) };
        });

        // Latest value should match written
        let id = await res.id.promise;
        let latest = await inTx(root, async (ctx) => {
            return await repo.readLatest(ctx, feed);
        });
        expect(latest!.seq).toBe(1);
        expect(latest!.state).toMatchObject(id);

        // Second write
        res = await inTx(root, async (ctx) => {

            // Initial should have correct value
            let initial = await repo.readFirstTransactionLatest(ctx, feed);
            expect(initial!.seq).toBe(1);
            expect(initial!.state).toMatchObject(id);

            // Write latest
            let seq = await seqs.allocateSeq(ctx, feed);
            let index = vt.allocateVersionstampIndex(ctx);
            await repo.writeLatest(ctx, feed, seq, index);

            // Initial read should still work as expected
            initial = await repo.readFirstTransactionLatest(ctx, feed);
            expect(initial!.seq).toBe(1);
            expect(initial!.state).toMatchObject(id);

            return { id: vt.resolveVersionstamp(ctx, index) };
        });

        // Latest value should match written
        id = await res.id.promise;
        latest = await inTx(root, async (ctx) => {
            return await repo.readLatest(ctx, feed);
        });
        expect(latest!.seq).toBe(2);
        expect(latest!.state).toMatchObject(id);
    });
});