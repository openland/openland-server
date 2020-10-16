import { LocalBusEngine } from './../../openland-module-pubsub/LocalBusEngine';
import { delay } from 'openland-utils/timer';
import { EventsMediator } from './EventsMediator';
import { EventsRepository } from './../repo/EventsRepository';
import { createNamedContext } from '@openland/context';
import { Database } from '@openland/foundationdb';

describe('EventsMediator', () => {
    it('should post and receive updates', async () => {
        jest.setTimeout(60000);
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-events-mediator', layers: [] });
        let repo = new EventsRepository(db.allKeys);
        let mediator = new EventsMediator(repo, new LocalBusEngine());
        let callback = jest.fn();
        let subscriber = await mediator.createSubscriber(root);
        let feed = await mediator.createFeed(root, 'forward-only');

        // Start receiver
        let receiver = mediator.receive(subscriber, callback, { checkpointDelay: { min: 500, max: 1000 }, checkpointCommitDelay: 1000 });

        // Wait for start
        await delay(1000);

        // Subscribe (to get update)
        await mediator.subscribe(root, subscriber, feed);

        // Post
        await mediator.post(root, { feed, event: Buffer.from('hello') });

        // Wait for event bus
        await delay(3000);

        // Close receiver
        receiver.close();

        // Expect three events: create, subscribe and close
        expect(callback.mock.calls.length).toBe(5);
    });
});