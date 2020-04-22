import { BusProvider, BusSubcription } from '@openland/foundationdb-bus';
import { Client } from 'ts-nats';

export class NatsBusProvider implements BusProvider {
    private nc: Client;
    private rootTopic = 'event_bus';
    private subscribers = new Map<string, Array<{ listener: (data: any) => void }>>();

    constructor(client: Client) {
        this.nc = client;

        this.nc.subscribe(this.rootTopic + '.*', (err, msg) => {
            if (err) {
                return;
            }

            let topic = msg.subject.replace(this.rootTopic + '.', '');
            let subs = this.subscribers.get(topic);
            if (!subs) {
                return;
            }

            for (let sub of subs) {
                sub.listener(msg.data);
            }
        });
    }

    publish(topic: string, data: any): void {
        this.nc.publish(this.rootTopic + '.' + topic, data);
    }

    subscribe(topic: string, receiver: (data: any) => void): BusSubcription {
        if (!this.subscribers.has(topic)) {
            this.subscribers.set(topic, []);
        }
        this.subscribers.get(topic)!!.push({ listener: receiver });
        return {
            cancel: () => {
                let subs = this.subscribers.get(topic);
                if (!subs) {
                    throw new Error('Pubsub inconsistency');
                }
                let index = subs.findIndex(s => s.listener === receiver);

                if (index === -1) {
                    throw new Error('Pubsub double unsubscribe');
                } else {
                    subs.splice(index, 1);
                }
            }
        };
    }
}
