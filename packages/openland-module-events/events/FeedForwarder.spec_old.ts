// import { FeedForwarder } from './FeedForwarder';
// import { EventsStorage } from '../repo/EventsStorage';
// import { createNamedContext } from '@openland/context';
// import { Database, encoders } from '@openland/foundationdb';

// function createEvent(id: number) {
//     return encoders.int32BE.pack(id);
// }

// describe('FeedForwarder', () => {
//     it('should successfuly initialize', async () => {
//         let root = createNamedContext('test');
//         let db = await Database.openTest({ name: 'feed-forward-init', layers: [] });
//         let storage = new EventsStorage(db.allKeys);

//         let feed = await storage.createFeed(root);
//         let subscriber = await storage.createSubscriber(root);
//         await storage.subscribe(root, subscriber, feed);
//         let since = (await storage.subscribedSince(root, { feed, subscriber }))!;
//         let seq = (await storage.getFeedSeq(root, feed));

//         // Initial forwarder creation
//         let forwarder = new FeedForwarder(feed, subscriber, storage);
//         let res = await forwarder.start(root, seq, since);
//         expect(res.length).toBe(0);

//         // Write events
//         let post1 = await storage.post(root, feed, createEvent(0));
//         let post2 = await storage.post(root, feed, createEvent(1));
//         let post3 = await storage.post(root, feed, createEvent(2));
//         let post4 = await storage.post(root, feed, createEvent(3));

//         // With events but from start
//         forwarder = new FeedForwarder(feed, subscriber, storage);
//         res = await forwarder.start(root, seq, since);
//         expect(res.length).toBe(4);
//         expect(res[0].seq).toBe(post1.seq);
//         expect(res[0].id).toMatchObject(await post1.id);
//         expect(res[1].seq).toBe(post2.seq);
//         expect(res[1].id).toMatchObject(await post2.id);
//         expect(res[2].seq).toBe(post3.seq);
//         expect(res[2].id).toMatchObject(await post3.id);
//         expect(res[3].seq).toBe(post4.seq);
//         expect(res[3].id).toMatchObject(await post4.id);
//     });
    
//     it('should handle updates', async () => {
//         let root = createNamedContext('test');
//         let db = await Database.openTest({ name: 'feed-forward-init', layers: [] });
//         let storage = new EventsStorage(db.allKeys);

//         let feed = await storage.createFeed(root);
//         let subscriber = await storage.createSubscriber(root);
//         await storage.subscribe(root, subscriber, feed);
//         let since = (await storage.subscribedSince(root, { feed, subscriber }))!;
//         let seq = (await storage.getFeedSeq(root, feed));

//         // Initial forwarder creation
//         let forwarder = new FeedForwarder(feed, subscriber, storage);
//         let res = await forwarder.start(root, seq, since);
//         expect(res.length).toBe(0);

//         // Write events
//         let post1 = await storage.post(root, feed, createEvent(0));
//         let post2 = await storage.post(root, feed, createEvent(1));
//         let post3 = await storage.post(root, feed, createEvent(2));
//         let post4 = await storage.post(root, feed, createEvent(3));
//         let post5 = await storage.post(root, feed, createEvent(4));

//         // With events but from start
//         let updated = await forwarder.receiveUpdate(root, post1.seq, await post1.id);
//         expect(updated.shouldForward).toBe(true);
//         expect(updated.wasStarted).toBe(false);
//         expect(updated.wasStopped).toBe(false);
//         expect(updated.missingUpdates.length).toBe(0);

//         updated = await forwarder.receiveUpdate(root, post3.seq, await post3.id);
//         expect(updated.shouldForward).toBe(true);
//         expect(updated.wasStarted).toBe(false);
//         expect(updated.wasStopped).toBe(false);
//         expect(updated.missingUpdates.length).toBe(0);

//         updated = await forwarder.receiveUpdate(root, post4.seq, await post4.id);
//         expect(updated.shouldForward).toBe(true);
//         expect(updated.wasStarted).toBe(false);
//         expect(updated.wasStopped).toBe(false);
//         expect(updated.missingUpdates.length).toBe(0);

//         updated = await forwarder.receiveUpdate(root, post2.seq, await post2.id);
//         expect(updated.shouldForward).toBe(true);
//         expect(updated.wasStarted).toBe(false);
//         expect(updated.wasStopped).toBe(false);
//         expect(updated.missingUpdates.length).toBe(0);

//         // Unsubscribe
//         await storage.unsubscribe(root, subscriber, feed);

//         // Handle state change
//         let stateChange = await forwarder.receiveStateChange(root);
//         expect(stateChange.wasStopped).toBe(true);
//         expect(stateChange.wasStarted).toBe(false);
//         expect(stateChange.missingUpdates.length).toBe(0);

//         // Must be ignored
//         updated = await forwarder.receiveUpdate(root, post5.seq, await post5.id);
//         expect(updated.shouldForward).toBe(false);
//         expect(updated.wasStarted).toBe(false);
//         expect(updated.wasStopped).toBe(false);
//         expect(updated.missingUpdates.length).toBe(0);

//         // Resubscribe + post
//         await storage.subscribe(root, subscriber, feed);
//         let post6 = await storage.post(root, feed, createEvent(5));

//         // Handle state change
//         stateChange = await forwarder.receiveStateChange(root);
//         expect(stateChange.wasStopped).toBe(false);
//         expect(stateChange.wasStarted).toBe(true);
//         expect(stateChange.missingUpdates.length).toBe(1);
//         expect(stateChange.missingUpdates[0].seq).toBe(post6.seq);
//         expect(stateChange.missingUpdates[0].id).toMatchObject(await post6.id);

//         // Must be ignored
//         updated = await forwarder.receiveUpdate(root, post5.seq, await post5.id);
//         expect(updated.shouldForward).toBe(false);
//         expect(updated.wasStarted).toBe(false);
//         expect(updated.wasStopped).toBe(false);
//         expect(updated.missingUpdates.length).toBe(0);

//         // Must be ignored
//         updated = await forwarder.receiveUpdate(root, post6.seq, await post6.id);
//         expect(updated.shouldForward).toBe(false);
//         expect(updated.wasStarted).toBe(false);
//         expect(updated.wasStopped).toBe(false);
//         expect(updated.missingUpdates.length).toBe(0);
//     });
// });