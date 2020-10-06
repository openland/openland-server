import { EventsRepository } from './EventsRepository';
import { createNamedContext } from '@openland/context';
import { Database } from '@openland/foundationdb';

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
});