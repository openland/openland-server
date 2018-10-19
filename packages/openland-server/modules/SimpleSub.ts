type Handler<V> = (ev: V) => void;

export class SimpleSub<K, V> {
    private subscriptions = new Map<K, Handler<V>[]>();

    public subscribe(topic: K, cb: Handler<V>): { cancel: () => void } {
        if (this.subscriptions.has(topic)) {
             this.subscriptions.get(topic)!.push(cb);
        } else {
            this.subscriptions.set(topic, [cb]);
        }

        return {
            cancel: () => {
                if (!this.subscriptions.get(topic)) {
                    throw new Error('SimpleSub inconsistency');
                } else {
                    let subs = this.subscriptions.get(topic)!;
                    let index = subs.indexOf(cb);

                    if (index === -1) {
                        throw new Error('SimpleSub double unwatch');
                    } else {
                        subs.splice(index, 1);
                    }
                }
            }
        };
    }

    public emit(topic: K, ev: V) {
        let subs = this.subscriptions.get(topic);

        if (!subs || subs.length === 0) {
            return;
        }

        [...subs].forEach(s => s(ev));
    }
}