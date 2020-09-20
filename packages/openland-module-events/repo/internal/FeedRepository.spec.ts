import { VersionStampRepository } from './VersionStampRepository';
import { randomId } from 'openland-utils/randomId';
import { FeedRepository } from './FeedRepository';
import { createNamedContext } from '@openland/context';
import { Database, inTx } from '@openland/foundationdb';

const ZERO = Buffer.alloc(0);

describe('FeedRepository', () => {
    it('should generate seq numbers', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-feed-seq', layers: [] });
        let repo = new FeedRepository(db.allKeys);
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

    it('should track latest values', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-feed-latest', layers: [] });
        let repo = new FeedRepository(db.allKeys);
        let vt = new VersionStampRepository(db);
        let feed = randomId();

        let res = await inTx(root, async (ctx) => {

            // Initial should be null
            let initial = await repo.readFirstTransactionLatest(ctx, feed);
            expect(initial).toBeNull();

            // Write latest
            repo.setSeq(ctx, feed, 0);
            let seq = await repo.allocateSeq(ctx, feed);
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
            let seq = await repo.allocateSeq(ctx, feed);
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

    it('should read and write events', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-feed-rw', layers: [] });
        let repo = new FeedRepository(db.allKeys);
        let vt = new VersionStampRepository(db);
        let feed = randomId();

        // Init and write single vent
        let res = await inTx(root, async (ctx) => {

            let initial = vt.allocateVersionstampIndex(ctx);

            repo.setSeq(ctx, feed, 0);

            // Write a single event
            let seq = await repo.allocateSeq(ctx, feed);
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
                let seq = await repo.allocateSeq(ctx, feed);
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

    // it('should collapse events', async () => {
    //     let root = createNamedContext('test');
    //     let db = await Database.openTest({ name: 'event-feed-rw-collapse', layers: [] });
    //     let repo = new FeedRepository(db.allKeys);
    //     let vt = new VersionStampRepository(db);
    //     let feed = randomId();

    //     // Init and write single vent
    //     let r = await inTx(root, async (ctx) => {

    //         let initial = vt.allocateVersionstampIndex(ctx);

    //         repo.setSeq(ctx, feed, 0);

    //         // Write a single event
    //         let seq = await repo.allocateSeq(ctx, feed);
    //         let index = vt.allocateVersionstampIndex(ctx);
    //         await repo.writeEvent(ctx, feed, ZERO, seq, index, Buffer.from('collapse'));

    //         return { state: vt.resolveVersionstamp(ctx, initial) };
    //     });
    //     let state = await r.state.promise;

    //     let read = await inTx(root, async (ctx) => {
    //         return await repo.getEvents(ctx, feed, { mode: 'forward', limit: 10, after: state });
    //     });
    //     expect(read.hasMore).toBe(false);
    //     expect(read.events.length).toBe(1);
    //     expect(read.events[0].seq).toBe(1);

    //     // Write collapsed
    //     await inTx(root, async (ctx) => {
    //         let seq = await repo.allocateSeq(ctx, feed);
    //         let index = vt.allocateVersionstampIndex(ctx);
    //         await repo.writeEvent(ctx, feed, ZERO, seq, index, Buffer.from('collapse'));
    //     });

    //     read = await inTx(root, async (ctx) => {
    //         return await repo.getEvents(ctx, feed, { mode: 'forward', limit: 10, after: state });
    //     });
    //     expect(read.hasMore).toBe(false);
    //     expect(read.events.length).toBe(1);
    //     expect(read.events[0].seq).toBe(2);

    //     // Write collapsed within a single transaction
    //     await inTx(root, async (ctx) => {
    //         let seq = await repo.allocateSeq(ctx, feed);
    //         let index = vt.allocateVersionstampIndex(ctx);
    //         await repo.writeEvent(ctx, feed, ZERO, seq, index, Buffer.from('collapse'));

    //         seq = await repo.allocateSeq(ctx, feed);
    //         index = vt.allocateVersionstampIndex(ctx);
    //         await repo.writeEvent(ctx, feed, ZERO, seq, index, Buffer.from('collapse'));
    //     });

    //     read = await inTx(root, async (ctx) => {
    //         return await repo.getEvents(ctx, feed, { mode: 'forward', limit: 10, after: state });
    //     });
    //     expect(read.hasMore).toBe(false);
    //     expect(read.events.length).toBe(1);
    //     expect(read.events[0].seq).toBe(4);
    // });
});