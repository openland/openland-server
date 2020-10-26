import { EventsRepository } from './EventsRepository';
import { createNamedContext } from '@openland/context';
import { Database } from '@openland/foundationdb';
const ZERO = Buffer.alloc(0);

function expectChangedFeeds(received: { feed: Buffer, seq: number, vt: Buffer }[], expected: { feed: Buffer, seq: number }[]) {
    expect(received.length).toBe(expected.length);
    for (let r of received) {
        let ex = (expected.find((e) => e.feed.equals(r.feed)))!;
        expect(ex).not.toBeUndefined();
        expect(r.seq).toBe(ex.seq);
    }
}

describe('EventsRepository', () => {
    it('should register subscriptions', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-events-root', layers: [] });
        let repo = new EventsRepository(db.allKeys);
        let feed1 = await repo.createFeed(root, 'generic');
        let feed2 = await repo.createFeed(root, 'generic');
        let subs1 = await repo.createSubscriber(root);
        let subs2 = await repo.createSubscriber(root);
        let now = Date.now();

        expect((await repo.getFeedOnlineSubscribers(root, feed1, now)).length).toBe(0);
        expect((await repo.getFeedOnlineSubscribers(root, feed2, now)).length).toBe(0);

        // Subscribe
        await repo.subscribe(root, subs1, feed1, 'direct');
        expect((await repo.getFeedOnlineSubscribers(root, feed1, now)).length).toBe(0);
        expect((await repo.getFeedOnlineSubscribers(root, feed2, now)).length).toBe(0);
        await repo.subscribe(root, subs2, feed1, 'direct');
        expect((await repo.getFeedOnlineSubscribers(root, feed1, now)).length).toBe(0);
        expect((await repo.getFeedOnlineSubscribers(root, feed2, now)).length).toBe(0);

        // Make online
        let now2 = now + 1000;
        await repo.refreshOnline(root, subs1, now2 + 6000);
        expect((await repo.getFeedOnlineSubscribers(root, feed1, now2)).length).toBe(1);
        expect((await repo.getFeedOnlineSubscribers(root, feed2, now2)).length).toBe(0);

        // Make online 2
        let now3 = now + 8000;
        await repo.refreshOnline(root, subs2, now3 + 6000);
        expect((await repo.getFeedOnlineSubscribers(root, feed1, now2)).length).toBe(2);
        expect((await repo.getFeedOnlineSubscribers(root, feed2, now2)).length).toBe(0);

        // Subscribe online member
        await repo.subscribe(root, subs2, feed2, 'async');
        expect((await repo.getFeedOnlineSubscribers(root, feed1, now2)).length).toBe(2);
        expect((await repo.getFeedOnlineSubscribers(root, feed2, now2)).length).toBe(1);
        expect((await repo.getFeedOnlineSubscribers(root, feed1, now3)).length).toBe(1);
        expect((await repo.getFeedOnlineSubscribers(root, feed2, now3)).length).toBe(1);
    });

    it('should post events and get changed feeds', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-events-changed', layers: [] });
        let repo = new EventsRepository(db.allKeys);

        for (let type of ['async', 'direct']) {
            let feed1 = await repo.createFeed(root, 'generic');
            let feed2 = await repo.createFeed(root, 'generic');
            let subs1 = await repo.createSubscriber(root);
            let subs2 = await repo.createSubscriber(root);
            let initial1 = await repo.getState(root, subs1);
            let initial2 = await repo.getState(root, subs2);

            // Initial difference
            expectChangedFeeds(await repo.getChangedFeedsSeqNumbers(root, subs1, initial1.vt.resolved.value), []);
            expectChangedFeeds(await repo.getChangedFeedsSeqNumbers(root, subs2, initial2.vt.resolved.value), []);
            let diff = await repo.getDifference(root, subs1, initial1.vt.resolved.value, { limits: { forwardOnly: 100, generic: 10, global: 1000 } });
            expect(diff.updates.length).toBe(0);
            diff = await repo.getDifference(root, subs2, initial2.vt.resolved.value, { limits: { forwardOnly: 100, generic: 10, global: 1000 } });
            expect(diff.updates.length).toBe(0);

            // Post to some feeds
            await repo.post(root, { feed: feed1, event: ZERO });
            await repo.post(root, { feed: feed2, event: ZERO });

            // Subscribe
            await repo.subscribe(root, subs1, feed1, type as 'async' | 'direct');
            await repo.subscribe(root, subs1, feed2, type as 'async' | 'direct');
            await repo.subscribe(root, subs2, feed1, type as 'async' | 'direct');

            // Should have two changed feeds
            expectChangedFeeds(await repo.getChangedFeedsSeqNumbers(root, subs1, initial1.vt.resolved.value), []);
            diff = await repo.getDifference(root, subs1, initial1.vt.resolved.value, { limits: { forwardOnly: 100, generic: 10, global: 1000 } });
            expect(diff.updates.length).toBe(0);
            expectChangedFeeds(await repo.getChangedFeedsSeqNumbers(root, subs1, initial1.vt.resolved.value), []);
            diff = await repo.getDifference(root, subs2, initial2.vt.resolved.value, { limits: { forwardOnly: 100, generic: 10, global: 1000 } });
            expect(diff.updates.length).toBe(0);

            // Should have zero changed since then
            let second1 = await repo.getState(root, subs1);
            let second2 = await repo.getState(root, subs2);
            expectChangedFeeds(await repo.getChangedFeedsSeqNumbers(root, subs1, second1.vt.resolved.value), []);
            expectChangedFeeds(await repo.getChangedFeedsSeqNumbers(root, subs2, second2.vt.resolved.value), []);

            // Post more
            let lastPost = await repo.post(root, { feed: feed1, event: ZERO });

            // Should detect new seq numbers
            expectChangedFeeds(await repo.getChangedFeedsSeqNumbers(root, subs1, second1.vt.resolved.value), [{ feed: feed1, seq: lastPost.seq }]);
            expectChangedFeeds(await repo.getChangedFeedsSeqNumbers(root, subs2, second2.vt.resolved.value), [{ feed: feed1, seq: lastPost.seq }]);
            expectChangedFeeds(await repo.getChangedFeedsSeqNumbers(root, subs1, initial1.vt.resolved.value), [{ feed: feed1, seq: lastPost.seq }]);
            expectChangedFeeds(await repo.getChangedFeedsSeqNumbers(root, subs2, initial2.vt.resolved.value), [{ feed: feed1, seq: lastPost.seq }]);
        }
    });
});