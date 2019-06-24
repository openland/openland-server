import { FDB } from 'openland-module-db/FDB';
import { BusLayer } from '@openland/foundationdb-bus';

class EventBusImpl {
    publish(topic: string, data: any) {
        FDB.layer.db.get(BusLayer).provider.publish(topic, data);
    }
    subscribe(topic: string, receiver: (data: any) => void) {
        return FDB.layer.db.get(BusLayer).provider.subscribe(topic, receiver);
    }
}

export const EventBus = new EventBusImpl();