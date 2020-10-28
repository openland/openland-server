import { FeedSeqRepository } from './FeedSeqRepository';
import { randomId } from 'openland-utils/randomId';
import { FeedEventsRepository } from './FeedEventsRepository';
import { createNamedContext } from '@openland/context';
import { Database, inTx, createVersionstampRef } from '@openland/foundationdb';

const ZERO = Buffer.alloc(0);

describe('FeedEventsRepository', () => {
    it('should read and write events', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-feed-rw', layers: [] });
        let repo = new FeedEventsRepository(db.allKeys);
        let seqs = new FeedSeqRepository(db.allKeys);
        let feed = randomId();

        // Init and write single vent
        let res = await inTx(root, async (ctx) => {

            let initial = createVersionstampRef(ctx);

            seqs.setSeq(ctx, feed, 0);

            // Write a single event
            let seq = await seqs.allocateSeq(ctx, feed);
            let vt = createVersionstampRef(ctx);
            repo.writeEvent(ctx, feed, ZERO, seq, vt);

            return { vt, initial };
        });
        let id = res.vt.resolved.value;
        let state = res.initial.resolved.value;

        let read = await inTx(root, async (ctx) => {
            return await repo.getEvents(ctx, feed, { mode: 'forward', limit: 10, after: state });
        });
        expect(read.hasMore).toBe(false);
        expect(read.events.length).toBe(1);
        expect(read.events[0].vt).toMatchObject(id);

        let prevSeq = await inTx(root, async (ctx) => {
            return await repo.getPreviousSeq(ctx, feed, state);
        });
        expect(prevSeq).toBe(0);

        // Write batch
        await inTx(root, async (ctx) => {

            // Write a single event
            for (let i = 0; i < 5; i++) {
                let seq = await seqs.allocateSeq(ctx, feed);
                let vt = createVersionstampRef(ctx);
                repo.writeEvent(ctx, feed, ZERO, seq, vt);
            }
        });

        read = await inTx(root, async (ctx) => {
            return await repo.getEvents(ctx, feed, { mode: 'forward', limit: 15, after: state });
        });
        expect(read.hasMore).toBe(false);
        expect(read.events.length).toBe(6);
        expect(read.events[0].vt).toMatchObject(id);
        for (let i = 0; i < 6; i++) {
            expect(read.events[i].seq).toBe(i + 1);
        }

        read = await inTx(root, async (ctx) => {
            return await repo.getEvents(ctx, feed, { mode: 'forward', limit: 15, after: 1 });
        });
        expect(read.hasMore).toBe(false);
        expect(read.events.length).toBe(5);
        for (let i = 2; i < 7; i++) {
            expect(read.events[i - 2].seq).toBe(i);
        }
    });

    it('should read and write collapsed events', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-feed-rw-collapsed', layers: [] });
        let repo = new FeedEventsRepository(db.allKeys);
        let seqs = new FeedSeqRepository(db.allKeys);
        let feed = randomId();

        // Init and write single vent
        let res = await inTx(root, async (ctx) => {

            let initial = createVersionstampRef(ctx);

            seqs.setSeq(ctx, feed, 0);

            // Write a single event
            let seq = await seqs.allocateSeq(ctx, feed);
            let vt = createVersionstampRef(ctx);
            await repo.writeCollapsedEvent(ctx, feed, ZERO, seq, vt, 'collapse-1');

            return { id: vt, state: initial };
        });
        let id = res.id.resolved.value;
        let state = res.state.resolved.value;

        let read = await inTx(root, async (ctx) => {
            return await repo.getEvents(ctx, feed, { mode: 'forward', limit: 10, after: state });
        });
        expect(read.hasMore).toBe(false);
        expect(read.events.length).toBe(1);
        expect(read.events[0].vt).toMatchObject(id);

        // Write batch
        await inTx(root, async (ctx) => {

            // Write a single event
            for (let i = 0; i < 5; i++) {
                let seq = await seqs.allocateSeq(ctx, feed);
                let vt = createVersionstampRef(ctx);
                await repo.writeCollapsedEvent(ctx, feed, ZERO, seq, vt, 'collapse-1');
            }
        });

        read = await inTx(root, async (ctx) => {
            return await repo.getEvents(ctx, feed, { mode: 'forward', limit: 15, after: state });
        });

        expect(read.hasMore).toBe(false);
        expect(read.events.length).toBe(1);
        // expect(read.events[0].id).toMatchObject(id);
        expect(read.events[0].seq).toBe(6);
    });
});