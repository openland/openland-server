import { BaseEvent } from '@openland/foundationdb-entity';
import { Store } from '../openland-module-db/FDB';
import { Context } from '@openland/context';
import { onContextCancel } from '@openland/lifetime';
import { createIterator } from '../openland-utils/asyncIterator';
import { EventBus } from './EventBus';

export class UnreliableEvents<T extends BaseEvent> {
    public readonly name: string;
    private readonly topicPrefix: string;

    constructor(name: string) {
        this.name = name;
        this.topicPrefix = 'unreliable_events.' + name;
    }

    post = (topic: string, ev: T) => {
        let coded = Store.eventFactory.encode(ev);
        EventBus.publish(this.#getSubTopicKey(topic), coded);
    }

    createLiveStream = (ctx: Context, topic: string) => {
        let iterator = createIterator<T>(() => 0);

        let subscription = EventBus.subscribe(this.#getSubTopicKey(topic), (data) => {
            iterator.push(Store.eventFactory.decode(data) as T);
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