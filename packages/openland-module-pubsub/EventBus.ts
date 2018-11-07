import { FPubsub } from 'foundation-orm/FPubsub';
import { createRedisClient, isRedisConfigured } from './redis/createRedisClient';
import { backoff } from 'openland-utils/timer';
import { createTracer } from 'openland-log/createTracer';
import { withTracing } from 'openland-log/withTracing';
import { createLogger } from 'openland-log/createLogger';

const tracer = createTracer('eventbus');
const logger = createLogger('eventbus');

class EventBusImpl implements FPubsub {
    private readonly client = isRedisConfigured ? createRedisClient() : undefined;
    private readonly subscriberClient = isRedisConfigured ? createRedisClient() : undefined;
    private subscribers = new Map<string, Array<{ listener: (data: any) => void }>>();
    private subscribedTopics = new Set<string>();

    constructor() {
        if (isRedisConfigured) {
            this.subscriberClient!.redis.on('message', (topic: string, message) => {

                // Check topic
                if (!this.subscribedTopics.has(topic)) {
                    return;
                }

                // tslint:disable-next-line:no-floating-promises
                withTracing(tracer, 'receive', () => {
                    // Parsing data
                    let parsed: any;
                    try {
                        parsed = JSON.parse(message);
                    } catch (e) {
                        return;
                    }

                    // Delivering notifications
                    for (let r of this.subscribers.get(topic)!!) {
                        r.listener(parsed);
                    }
                });
            });
        }
    }

    publish(topic: string, data: any) {
        if (isRedisConfigured) {
            // tslint:disable-next-line:no-floating-promises
            backoff(async () => await this.client!.publish(topic, JSON.stringify(data)));
        } else {
            // Simulate redis if not configured
            setTimeout(() => {
                let subscribers = this.subscribers.get(topic);
                if (subscribers) {
                    for (let r of [...subscribers]) {
                        r.listener(data);
                    }
                }
            });
        }
    }

    subscribe(topic: string, receiver: (data: any) => void) {

        if (!this.subscribedTopics.has(topic)) {
            this.subscribedTopics.add(topic);
            if (isRedisConfigured) {
                // tslint:disable-next-line:no-floating-promises
                backoff(async () => await this.subscriberClient!.subscribe([topic]));
            }
        }
        if (!this.subscribers.has(topic)) {
            this.subscribers.set(topic, []);
        }
        this.subscribers.get(topic)!!.push({ listener: receiver });
        return {
            cancel: () => {
                let subs = this.subscribers.get(topic)!;
                let index = subs.findIndex(s => s.listener === receiver);

                if (index === -1) {
                    logger.warn('Double unsubscribe from event bus for topic ' + topic);
                } else {
                    subs.splice(index, 1);
                }
            }
        };
    }
}

export const EventBus = new EventBusImpl();