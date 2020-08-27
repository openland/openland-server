import { FeedTracker } from './FeedTracker';
import { EventsStorage } from '../repo/EventsStorage';
import { createNamedContext } from '@openland/context';
import { Database, encoders } from '@openland/foundationdb';

function createEvent(id: number) {
    return encoders.int32BE.pack(id);
}

describe('FeedTracker', () => {
    it('should work recover holes', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'feed-tracker-updates', layers: [] });
        let storage = new EventsStorage(db.allKeys);

        // Create entities
        let feed = await storage.createFeed(root);
        let subscriber = await storage.createSubscriber(root);
        let state = await storage.getState(root, subscriber);
        let seq = await storage.getFeedSeq(root, feed);

        // Create tracker
        let tracker = new FeedTracker(feed, seq, state, storage);

        // First post
        let post1 = await storage.post(root, feed, createEvent(0));
        let post2 = await storage.post(root, feed, createEvent(1));
        let post3 = await storage.post(root, feed, createEvent(2));
        let post4 = await storage.post(root, feed, createEvent(3));
        await storage.post(root, feed, createEvent(4));
        let post6 = await storage.post(root, feed, createEvent(5));
        let post7 = await storage.post(root, feed, createEvent(6));

        // First update
        let update = await tracker.receiveUpdate(post1.seq, await post1.id);
        expect(update.shouldHandle).toBe(true);
        expect(update.invalidated).toBe(false);
        expect(tracker.isInvalidated).toBe(false);

        // Double update
        update = await tracker.receiveUpdate(post1.seq, await post1.id);
        expect(update.shouldHandle).toBe(false);
        expect(update.invalidated).toBe(false);
        expect(tracker.isInvalidated).toBe(false);

        // Skip one update
        update = await tracker.receiveUpdate(post3.seq, await post3.id);
        expect(update.shouldHandle).toBe(true);
        expect(update.invalidated).toBe(true);
        expect(tracker.isInvalidated).toBe(true);

        // Still skipping
        update = await tracker.receiveUpdate(post4.seq, await post4.id);
        expect(update.shouldHandle).toBe(true);
        expect(update.invalidated).toBe(true);
        expect(tracker.isInvalidated).toBe(true);

        // Restore sequence
        update = await tracker.receiveUpdate(post2.seq, await post2.id);
        expect(update.shouldHandle).toBe(true);
        expect(update.invalidated).toBe(false);
        expect(tracker.isInvalidated).toBe(false);

        // New skipped update
        update = await tracker.receiveUpdate(post6.seq, await post6.id);
        expect(update.shouldHandle).toBe(true);
        expect(update.invalidated).toBe(true);
        expect(tracker.isInvalidated).toBe(true);

        // Synchronize
        let event = (await tracker.synchronize(root))!;
        expect(event).not.toBeNull();
        expect(event.seq).toBe(7);
        expect(event.body).toMatchObject(createEvent(6));
        expect(event.id).toMatchObject(await post7.id);

        // Double synchronize
        event = (await tracker.synchronize(root))!;
        expect(event).toBeNull();
    });
});