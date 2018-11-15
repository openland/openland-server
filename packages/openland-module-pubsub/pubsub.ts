import { EventBus } from './EventBus';
import { createLogger } from 'openland-log/createLogger';
import { createEmptyContext } from 'openland-utils/Context';

export type PubsubSubcription = { cancel(): void };

const log = createLogger('pubsub');

export class Pubsub<T> {

    private readonly useRedis: boolean;
    private subscribers = new Map<string, Array<{ listener: (data: T) => void }>>();

    constructor(useRedis: boolean = true) {
        this.useRedis = useRedis;
    }

    async publish(topic: string, data: T) {
        if (this.useRedis) {
            EventBus.publish(topic, data);
        } else {

            // Simulate redis if not configured
            setTimeout(() => {
                let subscribers = this.subscribers.get(topic);
                if (subscribers) {
                    for (let r of [...subscribers]) {
                        log.debug(createEmptyContext(), 'local fire for ' + topic);
                        r.listener(data);
                    }
                }
            }, 0);
        }
    }

    async subscribe(topic: string, receiver: (data: T) => void): Promise<PubsubSubcription> {
        if (this.useRedis) {
            return EventBus.subscribe(topic, (src) => { receiver(src); });
        }

        if (!this.subscribers.has(topic)) {
            this.subscribers.set(topic, []);
        }
        this.subscribers.get(topic)!!.push({ listener: receiver });
        return {
            cancel: () => {
                if (!this.subscribers.get(topic)) {
                    throw new Error('Pubsub inconsistency');
                } else {
                    let subs = this.subscribers.get(topic)!;
                    let index = subs.findIndex(s => s.listener === receiver);

                    if (index === -1) {
                        throw new Error('Pubsub double unwatch');
                    } else {
                        subs.splice(index, 1);
                    }
                }
            }
        };
    }
}