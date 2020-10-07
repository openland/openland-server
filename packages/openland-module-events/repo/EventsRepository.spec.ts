import { EventsRepository } from './EventsRepository';
import { createNamedContext } from '@openland/context';
import { Database } from '@openland/foundationdb';
const ZERO = Buffer.alloc(0);

describe('EventsRepository', () => {
    it('should register subscriptions', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-events-root', layers: [] });
        let repo = new EventsRepository(db.allKeys);
        let feed1 = await repo.createFeed(root);
        let feed2 = await repo.createFeed(root);
        let subs1 = await repo.createSubscriber(root);
        let subs2 = await repo.createSubscriber(root);
        let now = Date.now();

        expect((await repo.getFeedOnlineSubscribers(root, feed1, now)).length).toBe(0);
        expect((await repo.getFeedOnlineSubscribers(root, feed2, now)).length).toBe(0);

        // Subscribe
        await repo.subscribe(root, subs1, feed1, { mode: 'direct', strict: false });
        expect((await repo.getFeedOnlineSubscribers(root, feed1, now)).length).toBe(0);
        expect((await repo.getFeedOnlineSubscribers(root, feed2, now)).length).toBe(0);
        await repo.subscribe(root, subs2, feed1, { mode: 'async', strict: false });
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
        await repo.subscribe(root, subs2, feed2, { mode: 'async', strict: false });
        expect((await repo.getFeedOnlineSubscribers(root, feed1, now2)).length).toBe(2);
        expect((await repo.getFeedOnlineSubscribers(root, feed2, now2)).length).toBe(1);
        expect((await repo.getFeedOnlineSubscribers(root, feed1, now3)).length).toBe(1);
        expect((await repo.getFeedOnlineSubscribers(root, feed2, now3)).length).toBe(1);
    });

    it('should post events and get changed feeds', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-events-root', layers: [] });
        let repo = new EventsRepository(db.allKeys);
        let feed1 = await repo.createFeed(root);
        let feed2 = await repo.createFeed(root);
        let subs1 = await repo.createSubscriber(root);
        let subs2 = await repo.createSubscriber(root);
        let initial1 = await repo.getState(root, subs1);
        let initial2 = await repo.getState(root, subs2);

        // Initial difference
        expect((await repo.getChangedFeeds(root, subs1, await initial1.state)).length).toBe(0);
        expect((await repo.getChangedFeeds(root, subs2, await initial2.state)).length).toBe(0);

        // Post to some feeds
        await repo.post(root, { feed: feed1, event: ZERO });
        await repo.post(root, { feed: feed2, event: ZERO });

        // Subscribe
        await repo.subscribe(root, subs1, feed1, { mode: 'direct', strict: false });
        await repo.subscribe(root, subs1, feed2, { mode: 'direct', strict: false });
        await repo.subscribe(root, subs2, feed1, { mode: 'direct', strict: false });

        // Should still have zero changed feeds
        expect((await repo.getChangedFeeds(root, subs1, await initial1.state)).length).toBe(0);
        expect((await repo.getChangedFeeds(root, subs2, await initial2.state)).length).toBe(0);

        // Post more
        await repo.post(root, { feed: feed1, event: ZERO });
        expect((await repo.getChangedFeeds(root, subs1, await initial1.state)).length).toBe(1);
        expect((await repo.getChangedFeeds(root, subs2, await initial2.state)).length).toBe(1);
    });
});