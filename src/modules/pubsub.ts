import * as Redis from './redis/redis';

export class Pubsub<T> {

    private client = Redis.redisClient();
    private subscriberClient = Redis.redisClient();
    private subscribers = new Map<string, Array<{ listener: (data: T) => void }>>();
    private subscribedTopics = new Set<string>();

    constructor() {
        if (this.subscriberClient) {
            this.subscriberClient.redis.on('message', (topic: string, message) => {
                // Check topic
                if (!this.subscribedTopics.has(topic)) {
                    return;
                }

                // Parsing data
                let parsed: T;
                try {
                    parsed = JSON.parse(message) as T;
                } catch (e) {
                    return;
                }

                // Delivering notifications
                for (let r of this.subscribers.get(topic)!!) {
                    r.listener(parsed);
                }
            });
        }
    }

    async publish(topic: string, data: T) {
        if (this.client) {
            await this.client.publish(topic, JSON.stringify(data));
        } else {

            // Simulate redis if not configured
            let subscribers = this.subscribers.get(topic);
            if (subscribers) {
                for (let r of subscribers) {
                    r.listener(data);
                }
            }
        }
    }

    async subscribe(topic: string, receiver: (data: T) => void) {
        if (!this.subscribedTopics.has(topic)) {
            this.subscribedTopics.add(topic);
            if (this.subscriberClient) {
                await this.subscriberClient.subscribe([topic]);
            }
        }
        if (!this.subscribers.has(topic)) {
            this.subscribers.set(topic, []);
        }
        this.subscribers.get(topic)!!.push({ listener: receiver });
    }
}