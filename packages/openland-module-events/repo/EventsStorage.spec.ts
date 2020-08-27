import { EventsStorage } from './EventsStorage';
import { createNamedContext } from '@openland/context';
import { Database, inTx, encoders } from '@openland/foundationdb';

function createEvent(id: number) {
    return encoders.int32BE.pack(id);
}

describe('EventsStorage', () => {
    it('posting should work', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-storage-posting', layers: [] });
        const zero = Buffer.alloc(0);

        for (let jumbo of [false, true]) {
            await inTx(root, async (ctx) => {
                db.allKeys.clearPrefixed(ctx, zero);
            });

            let storage = new EventsStorage(db.allKeys);

            // Create feed and subscriber
            let ids = await inTx(root, async (ctx) => {
                let feed = (await storage.createFeed(ctx));
                if (jumbo) {
                    await storage.upgradeFeed(ctx, feed);
                }
                let subscriber1 = await storage.createSubscriber(ctx);
                let subscriber2 = await storage.createSubscriber(ctx);
                await storage.subscribe(ctx, subscriber1, feed);
                await storage.subscribe(ctx, subscriber2, feed);
                return { feed, subscriber1, subscriber2 };
            });

            // Check jumbo subscriptions
            let subscriberJumbo1 = await storage.getSubscriberJumboSubscriptions(root, ids.subscriber1);
            let subscriberJumbo2 = await storage.getSubscriberJumboSubscriptions(root, ids.subscriber2);
            if (jumbo) {
                expect(subscriberJumbo1.length).toBe(1);
                expect(subscriberJumbo2.length).toBe(1);
                expect(subscriberJumbo1[0]).toMatchObject(ids.feed);
                expect(subscriberJumbo2[0]).toMatchObject(ids.feed);
            } else {
                expect(subscriberJumbo1.length).toBe(0);
                expect(subscriberJumbo2.length).toBe(0);
            }

            // Get current state
            let state = await storage.getState(root, ids.subscriber1);

            // Get subscriber state
            let subscriberState1 = await storage.getSubscriberState(root, ids.subscriber1);

            // Create a post
            let postId = await (await inTx(root, async (ctx) => {
                let posted = await storage.post(ctx, ids.feed, zero);
                expect(posted.seq).toBe(1);
                if (!jumbo) {
                    expect(posted.subscribers).not.toBeNull();
                    expect(posted.subscribers!.length).toBe(2);
                } else {
                    expect(posted.subscribers).toBeNull();
                }
                return posted;
            })).id;

            // Get subscriber state
            let subscriberState2 = await storage.getSubscriberState(root, ids.subscriber1);

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
            expect(diff.events[0].seq).toBe(1);
            expect(diff.events[0].body!.length).toBe(0);

            // Check second difference
            diff = await storage.getDifference(root, ids.subscriber1, { state: diff.events[0].id, batchSize: 10, limit: 100 });
            expect(diff.events.length).toBe(0);
            expect(diff.partial.length).toBe(0);
            expect(diff.completed).toBe(true);

            // Unsubscribe
            await inTx(root, async (ctx) => {
                await storage.unsubscribe(ctx, ids.subscriber1, ids.feed);
            });
            let subsState = await storage.getSubscriberState(root, ids.subscriber1);
            expect(subsState.length).toBe(0);
        }
    });

    it('loading feed updates should work', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-storage-feed-updates', layers: [] });
        let storage = new EventsStorage(db.allKeys);

        let ids = await inTx(root, async (ctx) => {
            let feed = (await storage.createFeed(ctx));
            let subscriber = await storage.createSubscriber(ctx);
            await storage.subscribe(ctx, subscriber, feed);
            return { feed, subscriber };
        });
        let state = await storage.getState(root, ids.subscriber);

        // Post events
        await storage.post(root, ids.feed, createEvent(0));
        await storage.post(root, ids.feed, createEvent(1));
        await storage.post(root, ids.feed, createEvent(2));
        await storage.post(root, ids.feed, createEvent(3));
        await storage.post(root, ids.feed, createEvent(4));
        await storage.post(root, ids.feed, createEvent(5));
        await storage.post(root, ids.feed, createEvent(6));
        await storage.post(root, ids.feed, createEvent(7));
        await storage.post(root, ids.feed, createEvent(8));
        await storage.post(root, ids.feed, createEvent(9));

        // Read only-latest
        let updates = await storage.getFeedUpdates(root, ids.feed, { after: state, limit: 3, mode: 'only-latest' });
        expect(updates.hasMore).toBe(true);
        expect(updates.updates.length).toBe(3);
        expect(updates.updates[0].body).toMatchObject(createEvent(7));
        expect(updates.updates[1].body).toMatchObject(createEvent(8));
        expect(updates.updates[2].body).toMatchObject(createEvent(9));

        updates = await storage.getFeedUpdates(root, ids.feed, { after: state, limit: 15, mode: 'only-latest' });
        expect(updates.hasMore).toBe(false);
        expect(updates.updates.length).toBe(10);
        expect(updates.updates[0].body).toMatchObject(createEvent(0));
        expect(updates.updates[1].body).toMatchObject(createEvent(1));
        expect(updates.updates[2].body).toMatchObject(createEvent(2));
        expect(updates.updates[3].body).toMatchObject(createEvent(3));
        expect(updates.updates[4].body).toMatchObject(createEvent(4));
        expect(updates.updates[5].body).toMatchObject(createEvent(5));
        expect(updates.updates[6].body).toMatchObject(createEvent(6));
        expect(updates.updates[7].body).toMatchObject(createEvent(7));
        expect(updates.updates[8].body).toMatchObject(createEvent(8));
        expect(updates.updates[9].body).toMatchObject(createEvent(9));

        // Read forward
        updates = await storage.getFeedUpdates(root, ids.feed, { after: state, limit: 3, mode: 'forward' });
        expect(updates.hasMore).toBe(true);
        expect(updates.updates.length).toBe(3);
        expect(updates.updates[0].body).toMatchObject(createEvent(0));
        expect(updates.updates[1].body).toMatchObject(createEvent(1));
        expect(updates.updates[2].body).toMatchObject(createEvent(2));

        updates = await storage.getFeedUpdates(root, ids.feed, { after: state, limit: 15, mode: 'forward' });
        expect(updates.hasMore).toBe(false);
        expect(updates.updates.length).toBe(10);
        expect(updates.updates[0].body).toMatchObject(createEvent(0));
        expect(updates.updates[1].body).toMatchObject(createEvent(1));
        expect(updates.updates[2].body).toMatchObject(createEvent(2));
        expect(updates.updates[3].body).toMatchObject(createEvent(3));
        expect(updates.updates[4].body).toMatchObject(createEvent(4));
        expect(updates.updates[5].body).toMatchObject(createEvent(5));
        expect(updates.updates[6].body).toMatchObject(createEvent(6));
        expect(updates.updates[7].body).toMatchObject(createEvent(7));
        expect(updates.updates[8].body).toMatchObject(createEvent(8));
        expect(updates.updates[9].body).toMatchObject(createEvent(9));
    });

    it('simple paging should work', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-storage-paging', layers: [] });
        const zero = Buffer.alloc(0);

        for (let jumbo of [false, true]) {

            let storage = new EventsStorage(db.allKeys);
            await inTx(root, async (ctx) => {
                db.allKeys.clearPrefixed(ctx, zero);
            });

            // Create feed and subscriber
            let ids = await inTx(root, async (ctx) => {
                let feed = (await storage.createFeed(ctx));
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
            for (let i = 0; i < 100; i++) {
                await inTx(root, async (ctx) => {
                    await storage.post(ctx, ids.feed, zero);
                });
            }

            // Simple partial diff
            let diff = await storage.getDifference(root, ids.subscriber, { state: state, batchSize: 10, limit: 10 });
            expect(diff.completed).toBe(true);
            expect(diff.partial.length).toBe(1);
            expect(Buffer.compare(diff.partial[0], ids.feed)).toBe(0);
            expect(diff.events.length).toBe(10);
            expect(diff.events[0].seq).toBe(91);
            expect(diff.events[1].seq).toBe(92);
            expect(diff.events[2].seq).toBe(93);
            expect(diff.events[3].seq).toBe(94);
            expect(diff.events[4].seq).toBe(95);
            expect(diff.events[5].seq).toBe(96);
            expect(diff.events[6].seq).toBe(97);
            expect(diff.events[7].seq).toBe(98);
            expect(diff.events[8].seq).toBe(99);
            expect(diff.events[9].seq).toBe(100);

            // Simple complete diff
            diff = await storage.getDifference(root, ids.subscriber, { state: state, batchSize: 110, limit: 110 });
            expect(diff.completed).toBe(true);
            expect(diff.partial.length).toBe(0);

            expect(diff.events.length).toBe(100);
            let seq = 1;
            for (let e of diff.events) {
                expect(e.seq).toBe(seq);
                seq++;
            }

            // Simple complete diff with limited output
            diff = await storage.getDifference(root, ids.subscriber, { state: state, batchSize: 110, limit: 10 });
            expect(diff.completed).toBe(false);
            expect(diff.partial.length).toBe(0);
            seq = 1;
            for (let e of diff.events) {
                expect(e.seq).toBe(seq);
                seq++;
            }

            // Continuation of previous diff
            diff = await storage.getDifference(root, ids.subscriber, { state: diff.events[diff.events.length - 1].id, batchSize: 110, limit: 10 });
            expect(diff.completed).toBe(false);
            expect(diff.partial.length).toBe(0);
            seq = 11;
            for (let e of diff.events) {
                expect(e.seq).toBe(seq);
                seq++;
            }
        }
    });

    it('strict paging should work', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-storage-paging-strict', layers: [] });
        const zero = Buffer.alloc(0);

        for (let jumbo of [false, true]) {

            let storage = new EventsStorage(db.allKeys);
            await inTx(root, async (ctx) => {
                db.allKeys.clearPrefixed(ctx, zero);
            });

            // Create feed and subscriber
            let ids = await inTx(root, async (ctx) => {
                let feed = (await storage.createFeed(ctx));
                if (jumbo) {
                    await storage.upgradeFeed(ctx, feed);
                }
                let subscriber = await storage.createSubscriber(ctx);
                await storage.subscribe(ctx, subscriber, feed, { strict: true });
                return { feed, subscriber };
            });

            // Get current state
            let state = await storage.getState(root, ids.subscriber);

            // Post 100 events
            for (let i = 0; i < 100; i++) {
                await inTx(root, async (ctx) => {
                    await storage.post(ctx, ids.feed, zero);
                });
            }

            // Simple partial diff
            let diff = await storage.getDifference(root, ids.subscriber, { state: state, batchSize: 20, limit: 10 });
            expect(diff.completed).toBe(false);
            expect(diff.partial.length).toBe(1);
            expect(Buffer.compare(diff.partial[0], ids.feed)).toBe(0);
            expect(diff.events.length).toBe(10);
            expect(diff.events[0].seq).toBe(1);
            expect(diff.events[1].seq).toBe(2);
            expect(diff.events[2].seq).toBe(3);
            expect(diff.events[3].seq).toBe(4);
            expect(diff.events[4].seq).toBe(5);
            expect(diff.events[5].seq).toBe(6);
            expect(diff.events[6].seq).toBe(7);
            expect(diff.events[7].seq).toBe(8);
            expect(diff.events[8].seq).toBe(9);
            expect(diff.events[9].seq).toBe(10);
        }
    });

    it('upgrade should work', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-storage-upgrade', layers: [] });

        let storage = new EventsStorage(db.allKeys);

        //
        // Create Feed and Subscriber, Upgrade and then subscribe
        //

        let feed = await inTx(root, async (ctx) => {
            return (await storage.createFeed(ctx));
        });

        let subscriber = await inTx(root, async (ctx) => {
            return await storage.createSubscriber(ctx);
        });

        // Initial state must be empty
        let state = await storage.getSubscriberState(root, subscriber);
        expect(state.length).toBe(0);

        // Check jumbo subscriptions
        let subscriberJumbo = await storage.getSubscriberJumboSubscriptions(root, subscriber);
        expect(subscriberJumbo.length).toBe(0);

        // Upgrade feed
        await inTx(root, async (ctx) => {
            await storage.upgradeFeed(ctx, feed);
        });

        // Subscribe
        await inTx(root, async (ctx) => {
            await storage.subscribe(ctx, subscriber, feed);
        });

        // State must be correct
        state = await storage.getSubscriberState(root, subscriber);
        expect(state.length).toBe(1);
        expect(state[0].id).toMatchObject(feed);
        expect(state[0].jumbo).toBe(true);
        expect(state[0].latest).toBe(null);

        // Check jumbo subscriptions
        subscriberJumbo = await storage.getSubscriberJumboSubscriptions(root, subscriber);
        expect(subscriberJumbo.length).toBe(1);
        expect(subscriberJumbo[0]).toMatchObject(feed);

        // Unsubscribe
        await inTx(root, async (ctx) => {
            await storage.unsubscribe(ctx, subscriber, feed);
        });
        state = await storage.getSubscriberState(root, subscriber);
        expect(state.length).toBe(0);

        // Check jumbo subscriptions
        subscriberJumbo = await storage.getSubscriberJumboSubscriptions(root, subscriber);
        expect(subscriberJumbo.length).toBe(0);

        //
        // Create Feed and Upgrade in the same transaction, then subscribe
        //

        feed = await inTx(root, async (ctx) => {
            let r = (await storage.createFeed(ctx));
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
        state = await storage.getSubscriberState(root, subscriber);
        expect(state.length).toBe(1);
        expect(state[0].id).toMatchObject(feed);
        expect(state[0].jumbo).toBe(true);
        expect(state[0].latest).toBe(null);

        // Check jumbo subscriptions
        subscriberJumbo = await storage.getSubscriberJumboSubscriptions(root, subscriber);
        expect(subscriberJumbo.length).toBe(1);
        expect(subscriberJumbo[0]).toMatchObject(feed);

        // Unsubscribe
        await inTx(root, async (ctx) => {
            await storage.unsubscribe(ctx, subscriber, feed);
        });
        state = await storage.getSubscriberState(root, subscriber);
        expect(state.length).toBe(0);

        // Check jumbo subscriptions
        subscriberJumbo = await storage.getSubscriberJumboSubscriptions(root, subscriber);
        expect(subscriberJumbo.length).toBe(0);

        //
        // Create Feed, Subscribe and then upgrade
        //

        feed = await inTx(root, async (ctx) => {
            return (await storage.createFeed(ctx));
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
        state = await storage.getSubscriberState(root, subscriber);
        expect(state.length).toBe(1);
        expect(state[0].id).toMatchObject(feed);
        expect(state[0].jumbo).toBe(true);
        expect(state[0].latest).toBe(null);

        // Check jumbo subscriptions
        subscriberJumbo = await storage.getSubscriberJumboSubscriptions(root, subscriber);
        expect(subscriberJumbo.length).toBe(1);
        expect(subscriberJumbo[0]).toMatchObject(feed);

        // Unsubscribe
        await inTx(root, async (ctx) => {
            await storage.unsubscribe(ctx, subscriber, feed);
        });
        state = await storage.getSubscriberState(root, subscriber);
        expect(state.length).toBe(0);

        // Check jumbo subscriptions
        subscriberJumbo = await storage.getSubscriberJumboSubscriptions(root, subscriber);
        expect(subscriberJumbo.length).toBe(0);
    });

    it('repeatKey should collapse updates', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-storage-repeat-key', layers: [] });
        let storage = new EventsStorage(db.allKeys);

        let ids = await inTx(root, async (ctx) => {
            let feed = (await storage.createFeed(ctx));
            let subscriber = await storage.createSubscriber(ctx);
            await storage.subscribe(ctx, subscriber, feed);
            return { feed, subscriber };
        });
        let state = await storage.getState(root, ids.subscriber);

        // Create initial
        let event1 = await inTx(root, async (ctx) => {
            return await storage.post(ctx, ids.feed, createEvent(0), { repeatKey: Buffer.from('repeat-key-0') });
        });
        let event2 = await inTx(root, async (ctx) => {
            return await storage.post(ctx, ids.feed, createEvent(1), { repeatKey: Buffer.from('repeat-key-1') });
        });
        let difference = await storage.getDifference(root, ids.subscriber, { state: state, batchSize: 10, limit: 10 });
        expect(difference.events.length).toBe(2);
        expect(difference.partial.length).toBe(0);
        expect(difference.events[0].body).toMatchObject(createEvent(0));
        expect(difference.events[0].seq).toBe(event1.seq);
        expect(difference.events[1].body).toMatchObject(createEvent(1));
        expect(difference.events[1].seq).toBe(event2.seq);

        // Update with collapse key and without
        let event3 = await inTx(root, async (ctx) => {
            return await storage.post(ctx, ids.feed, createEvent(2), { repeatKey: Buffer.from('repeat-key-0') });
        });
        let event4 = await inTx(root, async (ctx) => {
            return await storage.post(ctx, ids.feed, createEvent(3));
        });

        difference = await storage.getDifference(root, ids.subscriber, { state: state, batchSize: 10, limit: 10 });
        expect(difference.events.length).toBe(3);
        expect(difference.partial.length).toBe(0);
        expect(difference.events[0].body).toMatchObject(createEvent(1));
        expect(difference.events[0].seq).toBe(event2.seq);
        expect(difference.events[1].body).toMatchObject(createEvent(2));
        expect(difference.events[1].seq).toBe(event3.seq);
        expect(difference.events[2].body).toMatchObject(createEvent(3));
        expect(difference.events[2].seq).toBe(event4.seq);
    });

    it('should be able to post multiple events to the same feed in the same transaction', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-storage-post-multiple', layers: [] });
        let storage = new EventsStorage(db.allKeys);

        // Initial
        let ids = await inTx(root, async (ctx) => {
            let feed = (await storage.createFeed(ctx));
            let subscriber = await storage.createSubscriber(ctx);
            await storage.subscribe(ctx, subscriber, feed);
            return { feed, subscriber };
        });

        // Simple post
        await inTx(root, async (ctx) => {
            await storage.post(ctx, ids.feed, createEvent(0));
            await storage.post(ctx, ids.feed, createEvent(1));
        });

        // Simple repeat key
        await inTx(root, async (ctx) => {
            await storage.post(ctx, ids.feed, createEvent(2), { repeatKey: Buffer.from('repeat-key-0') });
            await storage.post(ctx, ids.feed, createEvent(3), { repeatKey: Buffer.from('repeat-key-0') });
        });
    });

    it('should detect changed feeds', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-storage-detect-changes', layers: [] });
        let storage = new EventsStorage(db.allKeys);

        // Prepare
        let ids = await inTx(root, async (ctx) => {
            let feed1 = (await storage.createFeed(ctx));
            let feed2 = (await storage.createFeed(ctx));
            let feed3 = (await storage.createFeed(ctx));
            let subscriber = await storage.createSubscriber(ctx);
            await storage.subscribe(ctx, subscriber, feed1);
            await storage.subscribe(ctx, subscriber, feed2);
            await storage.subscribe(ctx, subscriber, feed3);
            return { feed1, feed2, feed3, subscriber };
        });
        let state = await storage.getState(root, ids.subscriber);

        // Initial
        let changed = await storage.getUpdatedFeeds(root, ids.subscriber, state);
        expect(changed.length).toBe(0);

        // Post single update
        await storage.post(root, ids.feed1, createEvent(0));
        changed = await storage.getUpdatedFeeds(root, ids.subscriber, state);
        expect(changed.length).toBe(1);
        expect(changed[0]).toMatchObject(ids.feed1);

        let newState = await storage.getState(root, ids.subscriber);
        changed = await storage.getUpdatedFeeds(root, ids.subscriber, newState);
        expect(changed.length).toBe(0);

        // Post second update to the same feed
        await storage.post(root, ids.feed1, createEvent(0));
        changed = await storage.getUpdatedFeeds(root, ids.subscriber, state);
        expect(changed.length).toBe(1);
        expect(changed[0]).toMatchObject(ids.feed1);
        changed = await storage.getUpdatedFeeds(root, ids.subscriber, newState);
        expect(changed.length).toBe(1);
        expect(changed[0]).toMatchObject(ids.feed1);

        // Post updates to second feed
        await inTx(root, async (ctx) => {
            await storage.post(ctx, ids.feed2, createEvent(10));
            await storage.post(ctx, ids.feed2, createEvent(11));
        });

        changed = await storage.getUpdatedFeeds(root, ids.subscriber, state);
        expect(changed.length).toBe(2);
        expect(changed[0]).toMatchObject(ids.feed1);
        expect(changed[1]).toMatchObject(ids.feed2);
    });

    it('feed changes should respect join and leave time', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-storage-respect-join', layers: [] });
        let storage = new EventsStorage(db.allKeys);

        let feed = await storage.createFeed(root);
        let subscriber = await storage.createSubscriber(root);
        let state = await storage.getState(root, subscriber);

        // Not available if subscriber is not subscribed
        expect(await storage.isUpdateAvailableToSubscriber(root, { feed, subscriber, id: state })).toBe(false);

        // Subscribe
        await storage.subscribe(root, subscriber, feed);
        let state2 = await storage.getState(root, subscriber);
        expect(await storage.isUpdateAvailableToSubscriber(root, { feed, subscriber, id: state })).toBe(false);
        expect(await storage.isUpdateAvailableToSubscriber(root, { feed, subscriber, id: state2 })).toBe(true);

        // Unsubscribe
        await storage.unsubscribe(root, subscriber, feed);
        let state3 = await storage.getState(root, subscriber);
        expect(await storage.isUpdateAvailableToSubscriber(root, { feed, subscriber, id: state })).toBe(false);
        expect(await storage.isUpdateAvailableToSubscriber(root, { feed, subscriber, id: state2 })).toBe(true);
        expect(await storage.isUpdateAvailableToSubscriber(root, { feed, subscriber, id: state3 })).toBe(false);
    });
});