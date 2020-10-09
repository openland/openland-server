import { LocalBusEngine } from './../../openland-module-pubsub/LocalBusEngine';
import { delay } from 'openland-utils/timer';
import { EventsMediator } from './EventsMediator';
import { EventsRepository } from './../repo/EventsRepository';
import { createNamedContext } from '@openland/context';
import { Database } from '@openland/foundationdb';

describe('EventsMediator', () => {
    it('should post and receive updates', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-events-mediator', layers: [] });
        let repo = new EventsRepository(db.allKeys);
        let mediator = new EventsMediator(repo, new LocalBusEngine());
        let callback = jest.fn();
        let subscriber = await mediator.createSubscriber(root);
        let feed = await mediator.createFeed(root);

        // Start receiver
        let receiver = mediator.receive(subscriber, callback);

        // Wait for start
        await delay(100);

        // Subscribe (to get update)
        await mediator.subscribe(root, subscriber, feed, false);

        // Wait for event bus
        await delay(100);

        // Close receiver
        receiver.close();

        // Expect three events: create, subscribe and close
        expect(callback.mock.calls.length).toBe(3);
    });
});