import { EventsStorage } from './EventsStorage';
import { createNamedContext } from '@openland/context';
import { Database, inTx } from '@openland/foundationdb';

describe('EventsStorage', () => {
    it('posting should work', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-storage-posting', layers: [] });
        const zero = Buffer.alloc(0);

        for (let jumbo of [false, true]) {
            await inTx(root, async (ctx) => {
                db.allKeys.clearPrefixed(ctx, zero);
            });

            let storage = await EventsStorage.open(db);

            // Create feed and subscriber
            let ids = await inTx(root, async (ctx) => {
                let feed = (await storage.createFeed(ctx)).id;
                if (jumbo) {
                    await storage.upgradeFeed(ctx, feed);
                }
                let subscriber1 = await storage.createSubscriber(ctx);
                let subscriber2 = await storage.createSubscriber(ctx);
                await storage.subscribe(ctx, subscriber1, feed);
                await storage.subscribe(ctx, subscriber2, feed);
                return { feed, subscriber1, subscriber2 };
            });

            // Get current state
            let state = await storage.getState(root, ids.subscriber1);

            // Get subscriber state
            let subscriberState1 = await storage.getSubscriberInternalState(root, ids.subscriber1);

            // Create a post
            let postId = await (await inTx(root, async (ctx) => {
                let posted = await storage.post(ctx, ids.feed, zero);
                expect(posted.seq).toBe(2);
                if (!jumbo) {
                    expect(posted.subscribers).not.toBeNull();
                    expect(posted.subscribers!.length).toBe(2);
                } else {
                    expect(posted.subscribers).toBeNull();
                }
                return storage.resolvePostId(ctx, posted.index);
            })).promise;

            // Get subscriber state
            let subscriberState2 = await storage.getSubscriberInternalState(root, ids.subscriber1);

            // Check id values
            expect(state.length).toBe(12);
            expect(postId.length).toBe(12);
            expect(Buffer.compare(state, postId) < 0).toBe(true);

            // Check state
            expect(subscriberState1.length).toBe(1);
            expect(Buffer.compare(subscriberState1[0].id, ids.feed) === 0).toBe(true);
            expect(subscriberState1[0].latest).toBeNull();
            expect(Buffer.compare(subscriberState1[0].joined, state) < 0).toBe(true);

            expect(subscriberState2.length).toBe(1);
            expect(Buffer.compare(subscriberState2[0].id, ids.feed) === 0).toBe(true);
            if (jumbo) {
                expect(subscriberState1[0].latest).toBeNull();
            } else {
                expect(Buffer.compare(subscriberState2[0].latest!, postId) === 0).toBe(true);
            }
            expect(Buffer.compare(subscriberState1[0].joined, subscriberState2[0].joined) === 0).toBe(true);

            // Check difference
            let diff = await storage.getDifference(root, ids.subscriber1, { state, batchSize: 10, limit: 100 });
            expect(diff.events.length).toBe(1);
            expect(diff.partial.length).toBe(0);
            expect(diff.completed).toBe(true);
            expect(Buffer.compare(diff.events[0].id, postId) === 0).toBe(true);
            expect(diff.events[0].seq).toBe(2);
            expect(diff.events[0].body!.length).toBe(0);

            // Check second difference
            diff = await storage.getDifference(root, ids.subscriber1, { state: diff.events[0].id, batchSize: 10, limit: 100 });
            expect(diff.events.length).toBe(0);
            expect(diff.partial.length).toBe(0);
            expect(diff.completed).toBe(true);
        }
    });

    it('simple paging should work', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-storage-paging', layers: [] });
        const zero = Buffer.alloc(0);

        for (let jumbo of [false, true]) {

            let storage = await EventsStorage.open(db);
            await inTx(root, async (ctx) => {
                db.allKeys.clearPrefixed(ctx, zero);
            });

            // Create feed and subscriber
            let ids = await inTx(root, async (ctx) => {
                let feed = (await storage.createFeed(ctx)).id;
                if (jumbo) {
                    await storage.upgradeFeed(ctx, feed);
                }
                let subscriber = await storage.createSubscriber(ctx);
                await storage.subscribe(ctx, subscriber, feed);
                return { feed, subscriber };
            });

            // Get current state
            let state = await storage.getState(root, ids.subscriber);

            // Post 100 events
            await inTx(root, async (ctx) => {
                for (let i = 0; i < 100; i++) {
                    await storage.post(ctx, ids.feed, zero);
                }
            });

            // Simple partial diff
            let diff = await storage.getDifference(root, ids.subscriber, { state: state, batchSize: 10, limit: 10 });
            expect(diff.completed).toBe(true);
            expect(diff.partial.length).toBe(1);
            expect(Buffer.compare(diff.partial[0], ids.feed)).toBe(0);
            expect(diff.events.length).toBe(10);
            expect(diff.events[0].seq).toBe(92);
            expect(diff.events[1].seq).toBe(93);
            expect(diff.events[2].seq).toBe(94);
            expect(diff.events[3].seq).toBe(95);
            expect(diff.events[4].seq).toBe(96);
            expect(diff.events[5].seq).toBe(97);
            expect(diff.events[6].seq).toBe(98);
            expect(diff.events[7].seq).toBe(99);
            expect(diff.events[8].seq).toBe(100);
            expect(diff.events[9].seq).toBe(101);

            // Simple complete diff
            diff = await storage.getDifference(root, ids.subscriber, { state: state, batchSize: 110, limit: 110 });
            expect(diff.completed).toBe(true);
            expect(diff.partial.length).toBe(0);

            // NOTE: Feed have 101 event (100 posts + creation event), but actual events that could be retreived is 100 since
            //       feed updates could be read only until subscription point drawing initial event always non-accessible
            expect(diff.events.length).toBe(100);
            let seq = 2;
            for (let e of diff.events) {
                expect(e.seq).toBe(seq);
                seq++;
            }

            // Simple complete diff with limited output
            diff = await storage.getDifference(root, ids.subscriber, { state: state, batchSize: 110, limit: 10 });
            expect(diff.completed).toBe(false);
            expect(diff.partial.length).toBe(0);
            seq = 2;
            for (let e of diff.events) {
                expect(e.seq).toBe(seq);
                seq++;
            }

            // Continuation of previous diff
            diff = await storage.getDifference(root, ids.subscriber, { state: diff.events[diff.events.length - 1].id, batchSize: 110, limit: 10 });
            expect(diff.completed).toBe(false);
            expect(diff.partial.length).toBe(0);
            seq = 12;
            for (let e of diff.events) {
                expect(e.seq).toBe(seq);
                seq++;
            }
        }
    });

    it('upgrade should work', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-storage-upgrade', layers: [] });

        let storage = await EventsStorage.open(db);

        //
        // Create Feed and Subscriber, Upgrade and then subscribe
        //

        let feed = await inTx(root, async (ctx) => {
            return (await storage.createFeed(ctx)).id;
        });

        let subscriber = await inTx(root, async (ctx) => {
            return await storage.createSubscriber(ctx);
        });

        // Initial state must be empty
        let state = await storage.getSubscriberInternalState(root, subscriber);
        expect(state.length).toBe(0);

        // Upgrade feed
        await inTx(root, async (ctx) => {
            await storage.upgradeFeed(ctx, feed);
        });

        // Subscribe
        await inTx(root, async (ctx) => {
            await storage.subscribe(ctx, subscriber, feed);
        });

        // State must be correct
        state = await storage.getSubscriberInternalState(root, subscriber);
        expect(state.length).toBe(1);
        expect(state[0].id).toMatchObject(feed);
        expect(state[0].jumbo).toBe(true);
        expect(state[0].latest).toBe(null);

        //
        // Create Feed and Upgrade in the same transaction, then subscribe
        //

        feed = await inTx(root, async (ctx) => {
            let r = (await storage.createFeed(ctx)).id;
            await storage.upgradeFeed(ctx, r);
            return r;
        });

        subscriber = await inTx(root, async (ctx) => {
            return await storage.createSubscriber(ctx);
        });

        // Subscribe
        await inTx(root, async (ctx) => {
            await storage.subscribe(ctx, subscriber, feed);
        });

        // State must be correct
        state = await storage.getSubscriberInternalState(root, subscriber);
        expect(state.length).toBe(1);
        expect(state[0].id).toMatchObject(feed);
        expect(state[0].jumbo).toBe(true);
        expect(state[0].latest).toBe(null);

        //
        // Create Feed, Subscribe and then upgrade
        //

        feed = await inTx(root, async (ctx) => {
            return (await storage.createFeed(ctx)).id;
        });

        subscriber = await inTx(root, async (ctx) => {
            return await storage.createSubscriber(ctx);
        });

        // Subscribe
        await inTx(root, async (ctx) => {
            await storage.subscribe(ctx, subscriber, feed);
        });

        // Upgrade feed
        await inTx(root, async (ctx) => {
            await storage.upgradeFeed(ctx, feed);
        });

        // State must be correct
        state = await storage.getSubscriberInternalState(root, subscriber);
        expect(state.length).toBe(1);
        expect(state[0].id).toMatchObject(feed);
        expect(state[0].jumbo).toBe(true);
        expect(state[0].latest).toBe(null);
    });
});