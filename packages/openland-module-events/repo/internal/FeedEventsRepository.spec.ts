import { FeedSeqRepository } from './FeedSeqRepository';
import { VersionStampRepository } from './VersionStampRepository';
import { randomId } from 'openland-utils/randomId';
import { FeedEventsRepository } from './FeedEventsRepository';
import { createNamedContext } from '@openland/context';
import { Database, inTx } from '@openland/foundationdb';

const ZERO = Buffer.alloc(0);

describe('FeedEventsRepository', () => {
    it('should read and write events', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-feed-rw', layers: [] });
        let repo = new FeedEventsRepository(db.allKeys);
        let seqs = new FeedSeqRepository(db.allKeys);
        let vt = new VersionStampRepository(db);
        let feed = randomId();

        // Init and write single vent
        let res = await inTx(root, async (ctx) => {

            let initial = vt.allocateVersionstampIndex(ctx);

            seqs.setSeq(ctx, feed, 0);

            // Write a single event
            let seq = await seqs.allocateSeq(ctx, feed);
            let index = vt.allocateVersionstampIndex(ctx);
            await repo.writeEvent(ctx, feed, ZERO, seq, index);

            return { id: vt.resolveVersionstamp(ctx, index), state: vt.resolveVersionstamp(ctx, initial) };
        });
        let id = await res.id.promise;
        let state = await res.state.promise;

        let read = await inTx(root, async (ctx) => {
            return await repo.getEvents(ctx, feed, { mode: 'forward', limit: 10, after: state });
        });
        expect(read.hasMore).toBe(false);
        expect(read.events.length).toBe(1);
        expect(read.events[0].id).toMatchObject(id);

        // Write batch
        await inTx(root, async (ctx) => {

            // Write a single event
            for (let i = 0; i < 5; i++) {
                let seq = await seqs.allocateSeq(ctx, feed);
                let index = vt.allocateVersionstampIndex(ctx);
                await repo.writeEvent(ctx, feed, ZERO, seq, index);
            }
        });

        read = await inTx(root, async (ctx) => {
            return await repo.getEvents(ctx, feed, { mode: 'forward', limit: 15, after: state });
        });
        expect(read.hasMore).toBe(false);
        expect(read.events.length).toBe(6);
        expect(read.events[0].id).toMatchObject(id);
        for (let i = 0; i < 6; i++) {
            expect(read.events[i].seq).toBe(i + 1);
        }
    });
});