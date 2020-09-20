import { SubscriberRepository } from './SubscriberRepository';
import { VersionStampRepository } from './VersionStampRepository';
import { randomId } from 'openland-utils/randomId';
import { createNamedContext } from '@openland/context';
import { Database, inTx } from '@openland/foundationdb';

describe('SubscriberRepository', () => {
    it('should implement direct subscribe', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-subscriber-direct', layers: [] });
        let repo = new SubscriberRepository(db.allKeys);
        let vt = new VersionStampRepository(db);
        let feed = randomId();
        let subscriber = randomId();

        // Add subscription
        let st = await inTx(root, async (ctx) => {

            let state = await repo.getSubscriptionState(ctx, subscriber, feed);
            expect(state).toBeNull();

            await repo.addDirectSubscription(ctx, subscriber, feed, false);

            let subscribers = await repo.getFeedDirectSubscribers(ctx, feed);
            expect(subscribers).toMatchObject([subscriber]);

            let directFeeds = await repo.getDirectFeeds(ctx, subscriber);
            expect(directFeeds).toMatchObject([feed]);

            let asyncFeeds = await repo.getAsyncFeeds(ctx, subscriber);
            expect(asyncFeeds).toMatchObject([]);

            state = await repo.getSubscriptionState(ctx, subscriber, feed);
            expect(state).toBe('direct');

            let start = vt.allocateVersionstampIndex(ctx);

            // Write updated reference
            let index = vt.allocateVersionstampIndex(ctx);
            await repo.setUpdatedReference(ctx, feed, 1, index);

            return { state: vt.resolveVersionstamp(ctx, start).promise };
        });
        let initialState = await st.state;

        // Check in another transaction
        await inTx(root, async (ctx) => {
            let subscribers = await repo.getFeedDirectSubscribers(ctx, feed);
            expect(subscribers).toMatchObject([subscriber]);

            let directFeeds = await repo.getDirectFeeds(ctx, subscriber);
            expect(directFeeds).toMatchObject([feed]);

            let asyncFeeds = await repo.getAsyncFeeds(ctx, subscriber);
            expect(asyncFeeds).toMatchObject([]);

            let state = await repo.getSubscriptionState(ctx, subscriber, feed);
            expect(state).toBe('direct');

            let updated = await repo.getDirectUpdated(ctx, subscriber, initialState);
            expect(updated.length).toBe(1);
        });

        // Remove subscription
        await inTx(root, async (ctx) => {
            let index = vt.allocateVersionstampIndex(ctx);
            await repo.setUpdatedReference(ctx, feed, 2, index);
            await repo.removeSubscription(ctx, subscriber, feed);
            await repo.removeUpdatedReference(ctx, subscriber, feed);

            let state = await repo.getSubscriptionState(ctx, subscriber, feed);
            expect(state).toBeNull();

            let subscribers = await repo.getFeedDirectSubscribers(ctx, feed);
            expect(subscribers).toMatchObject([]);

            let directFeeds = await repo.getDirectFeeds(ctx, subscriber);
            expect(directFeeds).toMatchObject([]);

            let asyncFeeds = await repo.getAsyncFeeds(ctx, subscriber);
            expect(asyncFeeds).toMatchObject([]);

            let updated = await repo.getDirectUpdated(ctx, subscriber, initialState);
            expect(updated.length).toBe(0);
        });
    });
});