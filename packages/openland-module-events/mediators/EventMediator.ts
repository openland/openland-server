import { EventsRepository } from './../repo/EventsRepository';
import { RegistrationsRepository } from './../repo/RegistrationsRepository';
import { Store } from 'openland-module-db/FDB';
import { Context } from '@openland/context';
import { Event, serializeEvent } from '../Definitions';
import { inTxLeaky, getTransaction, encoders } from '@openland/foundationdb';
import { EventBus } from 'openland-module-pubsub/EventBus';

export class EventMediator {

    readonly repo = new EventsRepository(Store.EventStorageDirectory);
    readonly registrations: RegistrationsRepository = new RegistrationsRepository(Store.EventRegistrationsDirectory, this.repo);

    //
    // Posting
    //

    postEvent = async (parent: Context, feed: Buffer, event: Event) => {
        await inTxLeaky(parent, async (ctx) => {
            let body = serializeEvent(event);
            let posted = await this.repo.post(ctx, { feed, event: body });

            getTransaction(ctx).afterCommit(async () => {
                let feedKey = feed.toString('hex');
                let feedBody = encoders.tuple.pack([1, posted.seq, body]);
                EventBus.publish(`events.feed.${feedKey}`, feedBody.toString('hex'));
                for (let subscriber of posted.subscribers) {
                    let subscriberKey = subscriber.subscriber.toString('hex');
                    let subscriberBody = encoders.tuple.pack([1, subscriber.seq, feed, posted.seq, body]);
                    EventBus.publish(`events.subscriber.${subscriberKey}`, subscriberBody.toString('hex'));
                }
            });
        });
    }
}