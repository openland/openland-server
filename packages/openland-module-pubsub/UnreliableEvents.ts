import { BaseEvent } from '@openland/foundationdb-entity';
import { Store } from '../openland-module-db/FDB';
import { NATS } from './NATS';
import { Context } from '@openland/context';
import { onContextCancel } from '@openland/lifetime';
import { createIterator } from '../openland-utils/asyncIterator';

export class UnreliableEvents<T extends BaseEvent> {
    public readonly name: string;
    private readonly topicPrefix: string;

    constructor(name: string) {
        this.name = name;
        this.topicPrefix = 'unreliable_events.' + name;
    }

    post = (topic: string, ev: T) => {
        let coded = Store.eventFactory.encode(ev);
        NATS.post(this.#getSubTopicKey(topic), coded);
    }

    createLiveStream = (ctx: Context, topic: string) => {
        let iterator = createIterator<T>(() => 0);

        let subscription = NATS.subscribe(this.#getSubTopicKey(topic), (ev) => {
            iterator.push(Store.eventFactory.decode(ev.data) as T);
        });

        onContextCancel(ctx, () => {
            iterator.complete();
            subscription.cancel();
        });

        return iterator;
    }

    #getSubTopicKey = (subTopic: string) => {
        return this.topicPrefix + '.' + subTopic;
    }
}