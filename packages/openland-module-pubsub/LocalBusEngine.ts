import { EventBusEngine, EventBusEngineSubcription } from './EventBusEngine';
import { nextTick } from 'process';

export class LocalBusEngine implements EventBusEngine {
    private subscriptions = new Map<string, ((data: any) => void)[]>();

    publish(topic: string, data: any) {
        nextTick(() => {
            let ex = this.subscriptions.get(topic);
            if (ex) {
                for (let l of [...ex]) {
                    l(data);
                }
            }
        });
    }

    subscribe(topic: string, receiver: (data: any) => void): EventBusEngineSubcription {
        let ex = this.subscriptions.get(topic);
        if (ex) {
            ex.push(receiver);
        } else {
            ex = [receiver];
            this.subscriptions.set(topic, ex);
        }
        let canceled = false;
        return {
            cancel: () => {
                if (canceled) {
                    return;
                }
                canceled = true;
                let index = ex!.findIndex(l => l === receiver);
                if (index === -1) {
                    throw new Error('Impossible');
                } else {
                    ex!.splice(index, 1);
                }
            }
        };
    }
}