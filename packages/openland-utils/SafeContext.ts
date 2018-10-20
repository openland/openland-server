import * as async_hooks from 'async_hooks';

export class SafeContext<T> {
    private contexts = new Map<number, T>();
    private currentUid = async_hooks.executionAsyncId();
    constructor() {
        async_hooks.createHook({
            init: (asyncId, type, triggerAsyncId, resource) => {
                let tx = this.contexts.get(triggerAsyncId) || this.contexts.get(this.currentUid);
                if (tx) {
                    this.contexts.set(asyncId, tx);
                }
            },
            before: (asyncId) => {
                this.currentUid = async_hooks.executionAsyncId();
            },
            after: (asyncId) => {
                this.contexts.delete(asyncId);
            }
        }).enable();
    }

    get value(): T | undefined {
        return this.contexts.get(this.currentUid);
    }

    set value(value: T | undefined) {
        if (value) {
            this.contexts.set(this.currentUid, value);
        } else {
            this.contexts.delete(this.currentUid);
        }
    }
}