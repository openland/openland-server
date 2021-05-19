import { EventBusEngine } from 'openland-module-pubsub/EventBusEngine';
import { BusLayer } from '@openland/foundationdb-bus';
import { Store } from 'openland-module-db/FDB';

type EventBusShards = 'metrics' | 'ephemeral' | 'default';
class EventBusImpl {
    private default: EventBusEngine | null = null;
    private shards = new Map<EventBusShards, EventBusEngine>();

    registerShard(shard: EventBusShards, src: EventBusEngine) {
        if (shard === 'default') {
            this.default = src;
        } else {
            this.shards.set(shard, src);
        }
    }

    publish(shard: EventBusShards, topic: string, data: any) {
        this.withShard(shard).publish(topic, data);
    }
    subscribe(shard: EventBusShards, topic: string, receiver: (data: any) => void): EventBusSubcription {
        return this.withShard(shard).subscribe(topic, receiver);
    }

    withShard(shard: EventBusShards) {
        if (!this.default) {
            this.default = Store.storage.db.get(BusLayer).provider;
        }
        if (this.shards.has(shard)) { 
            return this.shards.get(shard)!;
        }
        return this.default;
    }
}

export declare type EventBusSubcription = {
    cancel(): void;
};

export const EventBus = new EventBusImpl();
