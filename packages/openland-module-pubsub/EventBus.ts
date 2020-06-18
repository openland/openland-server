import { BusLayer } from '@openland/foundationdb-bus';
import { Store } from 'openland-module-db/FDB';

class EventBusImpl {
    publish(topic: string, data: any) {
        Store.storage.db.get(BusLayer).provider.publish(topic, data);
    }
    subscribe(topic: string, receiver: (data: any) => void): EventBusSubcription {
        return Store.storage.db.get(BusLayer).provider.subscribe(topic, receiver);
    }
}

export declare type EventBusSubcription = {
    cancel(): void;
};

export const EventBus = new EventBusImpl();
