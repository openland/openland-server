import { EventBusEngine, EventBusEngineSubcription } from './EventBusEngine';
import { Client, Subscription } from 'ts-nats';
import { asyncRun } from '../openland-mtproto3/utils';
import { Metrics } from 'openland-module-monitoring/Metrics';

interface TopicSubscription {
    canceled: boolean;
    ncSubscription?: Subscription;
    listeners: ((data: any) => void)[];
}

function extractTopicTag(src: string) {
    let index = src.indexOf('.');
    if (index >= 0) {
        return src.slice(0, index);
    }

    index = src.indexOf('_');
    if (index >= 0) {
        return src.slice(0, index);
    }

    index = src.indexOf('-');
    if (index >= 0) {
        return src.slice(0, index);
    }

    return src;
}

export class NatsBusEngine implements EventBusEngine {
    private nc: Client;
    private rootTopic = 'event_bus';
    private subscriptions = new Map<string, TopicSubscription>();

    constructor(client: Client) {
        this.nc = client;
    }

    publish(topic: string, data: any): void {
        this.nc.publish(this.rootTopic + '.' + topic, { payload: data });
        Metrics.EventsSent.inc();
        Metrics.EventsTaggedSent.inc(extractTopicTag(topic));
    }

    subscribe(topic: string, receiver: (data: any) => void): EventBusEngineSubcription {
        let existing = this.subscriptions.get(topic);
        if (existing) {
            existing.listeners.push(receiver);
        } else {
            this.createNewSubscription(topic, receiver);
        }

        let canceled = false;
        return {
            cancel: () => {
                if (canceled) {
                    return;
                }
                canceled = true;
                this.unsubscribe(topic, receiver);
            }
        };
    }

    private createNewSubscription(topic: string, receiver: (data: any) => void) {
        if (this.subscriptions.has(topic)) {
            return this.subscriptions.get(topic)!;
        }

        let subscription: TopicSubscription = { listeners: [receiver], canceled: false };
        this.subscriptions.set(topic, subscription);

        asyncRun(async () => {
            let ncSubscription = await this.nc.subscribe(this.rootTopic + '.' + topic, (err, msg) => {
                Metrics.EventsReceived.inc();
                Metrics.EventsTaggedReceived.inc(extractTopicTag(topic));

                if (err) {
                    return;
                }

                for (let listener of subscription.listeners) {
                    listener(msg.data.payload);
                }
            });

            // in case of race condition
            if (subscription.canceled) {
                ncSubscription.unsubscribe();
            } else {
                subscription.ncSubscription = ncSubscription;
            }
        });

        return subscription;
    }

    private unsubscribe(topic: string, receiver: (data: any) => void) {
        let sub = this.subscriptions.get(topic);
        if (!sub) {
            throw new Error('Pubsub inconsistency');
        }

        let index = sub.listeners.findIndex(l => l === receiver);

        if (index === -1) {
            throw new Error('Pubsub double unsubscribe');
        } else {
            sub.listeners.splice(index, 1);
        }

        if (sub.listeners.length === 0) {
            sub.canceled = true;
            sub.ncSubscription?.unsubscribe();
            this.subscriptions.delete(topic);
        }
    }
}
