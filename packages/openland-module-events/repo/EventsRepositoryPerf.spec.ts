import { EventsRepository } from './EventsRepository';
import { createNamedContext } from '@openland/context';
import { Database, inTx } from '@openland/foundationdb';

describe('EventsRepositoryPerf', () => {
    it('should register and subscribe', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-events-perf', layers: [] });
        let repo = new EventsRepository(db.allKeys);

        // Initial feeds
        let feeds = await inTx(root, async (ctx) => {
            let res: Buffer[] = [];
            for (let i = 0; i < 5000; i++) {
                res.push(await repo.createFeed(ctx));
            }
            return res;
        });

        // Subscribe
        let subscriber: Buffer = await repo.createSubscriber(root);
        let state0 = await repo.getState(root, subscriber);
        await inTx(root, async (ctx) => {
            for (let f of feeds) {
                await repo.subscribe(ctx, subscriber, f, { mode: 'direct', strict: false });
            }
        });
        let state1 = await repo.getState(root, subscriber);

        // Check changed feeds
        let chfeeds = await repo.getChangedFeeds(root, subscriber, await state0.state);
        expect(chfeeds.length).toBe(feeds.length);

        // Check changed after subscription
        chfeeds = await repo.getChangedFeeds(root, subscriber, await state1.state);
        expect(chfeeds.length).toBe(0);
    });
});