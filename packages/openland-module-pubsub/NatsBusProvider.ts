import { BusProvider, BusSubcription } from '@openland/foundationdb-bus';
import { Client, Subscription } from 'ts-nats';
import { asyncRun } from '../openland-mtproto3/utils';

type TopicSubscription = {
    ncSubscription?: Subscription,
    listeners: ((data: any) => void)[]
};

export class NatsBusProvider implements BusProvider {
    private nc: Client;
    private rootTopic = 'event_bus';
    private subscriptions = new Map<string, TopicSubscription>();

    constructor(client: Client) {
        this.nc = client;
    }

    publish(topic: string, data: any): void {
        this.nc.publish(this.rootTopic + '.' + topic, { payload: data });
    }

    subscribe(topic: string, receiver: (data: any) => void): BusSubcription {
        let subscription = this.getSubscription(topic);
        subscription.listeners.push(receiver);

        return {
            cancel: () => {
                this.unSubscribe(topic, receiver);
            }
        };
    }

    private getSubscription(topic: string) {
        if (this.subscriptions.has(topic)) {
            this.subscriptions.get(topic);
        }

        let subscription: TopicSubscription = { listeners: [] };
        this.subscriptions.set(topic, subscription);

        asyncRun(async () => {
            let ncSubscription = await this.nc.subscribe(this.rootTopic + '.' + topic, (err, msg) => {
                if (err) {
                    return;
                }

                for (let listener of subscription.listeners) {
                    listener(msg.data.payload);
                }
            });

            // in case of race condition
            if (subscription.ncSubscription) {
                ncSubscription.unsubscribe();
            } else {
                subscription.ncSubscription = ncSubscription;
            }
        });

        return subscription;
    }

    private unSubscribe(topic: string, receiver: (data: any) => void) {
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
            sub.ncSubscription?.unsubscribe();
            this.subscriptions.delete(topic);
        }
    }
}
