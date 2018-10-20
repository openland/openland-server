import async_hooks from 'async_hooks';
const ENABLE_DEBUG = false;

let contexts: any[] = [];
let debug: string[] = [];
async_hooks.createHook({
    init: (asyncId, type, triggerAsyncId, resource) => {
        if (ENABLE_DEBUG) {
            debug.push(`INIT ${asyncId} ${type} ${triggerAsyncId} ${async_hooks.executionAsyncId()}`);
        }

        let currentId = async_hooks.executionAsyncId();

        // JS based callback/promise
        if (currentId !== 0) {
            for (let ctxId in contexts) {
                let ctx = contexts[ctxId];
                let value = ctx[currentId];
                if (value) {
                    if (ENABLE_DEBUG) {
                        debug.push(`CONTEXT FOUND ${ctxId}.${currentId}`);
                    }
                    ctx[asyncId] = value;
                }
            }
            return;
        }
    },
    after: (asyncId) => {
        for (let ctx of contexts) {
            let value = ctx[asyncId];
            if (value) {
                delete ctx[asyncId];
            }
        }
    }
}).enable();

export function logContext(point: string) {
    debug.push(`CHECKPOINT: ${point} ${async_hooks.executionAsyncId()}`);
}

export function exportContextDebug() {
    let d = debug;
    debug = [];
    console.log(d.join('\n'));
}

export class SafeContext<T> {
    private static nextId = 0;
    private readonly id = SafeContext.nextId++;

    constructor() {
        contexts.push({});
    }

    async withContext<P>(value: T | undefined, callback: () => Promise<P>): Promise<P> {
        let sourceAsyncId = async_hooks.executionAsyncId();
        let current = contexts[this.id][sourceAsyncId];
        if (value) {
            contexts[this.id][sourceAsyncId] = value;
        } else {
            delete contexts[this.id][sourceAsyncId];
        }
        let res: Promise<P>;
        try {
            res = callback();
        } finally {
            if (current) {
                contexts[this.id][sourceAsyncId] = current;
            } else {
                delete contexts[this.id][sourceAsyncId];
            }
        }
        return await res;
    }

    get value(): T | undefined {
        if (ENABLE_DEBUG) {
            debug.push(`read: ${async_hooks.executionAsyncId()}`);
        }
        return contexts[this.id][async_hooks.executionAsyncId()];
    }
}