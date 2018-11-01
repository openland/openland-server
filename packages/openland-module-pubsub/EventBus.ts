import { FPubsub } from 'foundation-orm/FPubsub';
import { createRedisClient } from './redis/createRedisClient';
import { backoff } from 'openland-server/utils/timer';
import { createTracer } from 'openland-log/createTracer';
import { withTracing } from 'openland-log/withTracing';
import { createLogger } from 'openland-log/createLogger';

const tracer = createTracer('eventbus');
const logger = createLogger('eventbus');

class EventBusImpl implements FPubsub {
    private readonly client = createRedisClient();
    private readonly subscriberClient = createRedisClient();
    private subscribers = new Map<string, Array<{ listener: (data: any) => void }>>();
    private subscribedTopics = new Set<string>();

    constructor() {
        this.subscriberClient.redis.on('message', (topic: string, message) => {

            // Check topic
            if (!this.subscribedTopics.has(topic)) {
                return;
            }

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

    publish(topic: string, data: any) {
        backoff(async () => await this.client.publish(topic, JSON.stringify(data)));
    }

    subscribe(topic: string, receiver: (data: any) => void) {
        if (!this.subscribedTopics.has(topic)) {
            this.subscribedTopics.add(topic);
            backoff(async () => await this.subscriberClient.subscribe([topic]));
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