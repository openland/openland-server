import { RegistrationsRepository } from './../repo/RegistrationsRepository';
import { Store } from 'openland-module-db/FDB';
import { SeqRepository } from './../repo/SeqRepository';
import { Context } from '@openland/context';
import { Event, serializeEvent, resolveRepeatKey } from '../Definitions';
import { inTxLeaky, getTransaction, encoders } from '@openland/foundationdb';
import { EventsStorage } from 'openland-module-events/repo/EventsStorage';
import { EventBus } from 'openland-module-pubsub/EventBus';

export class EventMediator {

    readonly storage: EventsStorage = new EventsStorage(Store.EventStorageDirectory);
    readonly seqRepository: SeqRepository = new SeqRepository(Store.EventUserSeqDirectory);
    readonly registrations: RegistrationsRepository = new RegistrationsRepository(Store.EventRegistrationsDirectory, this.storage);

    //
    // Posting
    //

    postEvent = async (parent: Context, feed: Buffer, event: Event) => {
        await inTxLeaky(parent, async (ctx) => {
            // let feedSource = await this.registrations.getFeedSource(ctx, feed);
            let repeatKey = resolveRepeatKey(event);
            let posted = await this.storage.post(ctx, feed, serializeEvent(event), { repeatKey });
            if (posted.subscribers && posted.subscribers.length > 0) {
                let now = Date.now();

                // Resolving targets
                let targets: { subscriber: Buffer, seq: number }[] = [];
                for (let subscriber of posted.subscribers) {
                    let allocatedSeq = await this.seqRepository.allocateSeqIfOnline(ctx, subscriber, now);
                    if (allocatedSeq) {
                        targets.push({ subscriber, seq: allocatedSeq });
                    }
                }

                // Notify
                getTransaction(ctx).afterCommit(async () => {
                    let postId = await posted.id;

                    // Post to feed event bus
                    let feedIdString = feed.toString('hex');
                    let feedBody = encoders.tuple.pack([1, posted.seq, postId]);
                    EventBus.publish(`events.feed.${feedIdString}`, feedBody.toString('hex'));

                    // Post to online subscribers
                    for (let target of targets) {
                        let subscriberId = target.subscriber.toString('hex');
                        let body = encoders.tuple.pack([1, target.seq, feed, posted.seq, postId]);
                        EventBus.publish(`events.subscriber.${subscriberId}`, body.toString('hex'));
                    }
                });
            }
        });
    }
}