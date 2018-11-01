import { FPubsub } from 'foundation-orm/FPubsub';

class NoOpBusImpl implements FPubsub {

    publish(topic: string, data: any) {
        // No op
    }
    subscribe(topic: string, receiver: (data: any) => void) {
        return {
            cancel: () => {
                // No op
            }
        };
    }
}

export const NoOpBus = new NoOpBusImpl();