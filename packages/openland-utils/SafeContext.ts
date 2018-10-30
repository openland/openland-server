import async_hooks from 'async_hooks';
const ENABLE_DEBUG = false;

function hrtime() {
    const t = process.hrtime();
    return t[0] * 1000000 + t[1] / 1000;
}
const asyncHooksRegEx = /\((internal\/)?async_hooks\.js:/;

function cleanStack(stack: any) {
    const frames = stack.split('\n');
    // this part is opinionated, but it's here to avoid confusing people with internals
    let i = frames.length - 1;
    while (i && !asyncHooksRegEx.test(frames[i])) {
        i--;
    }
    return frames.slice(i + 1, stack.length - 1);
}

let contexts: any[] = [];
let paths: any = {};
let debug: string[] = [];
contexts[-1] = {};
async_hooks.createHook({
    init: (asyncId, type, triggerAsyncId, resource) => {
        if (ENABLE_DEBUG) {
            debug.push(`INIT ${asyncId} ${type} ${triggerAsyncId} ${async_hooks.executionAsyncId()}`);
        }

        let currentId = async_hooks.executionAsyncId();

        const e = {};
        Error.captureStackTrace(e);
        contexts[-1][asyncId] = { stack: (e as any).stack };

        // JS based callback/promise
        if (currentId !== 0) {
            if (ENABLE_DEBUG) {
                if (paths[currentId]) {
                    paths[asyncId] = [...paths[currentId], asyncId];
                } else {
                    paths[asyncId] = [asyncId];
                }
            }
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
    before: (asyncId) => {
        if (contexts[-1][asyncId]) {
            contexts[-1][asyncId].t0 = hrtime();
        }
    },
    after: (asyncId) => {
        let ex = contexts[-1][asyncId];
        if (ex && ex.t0) {
            let delta = (hrtime() - ex.t0) / 1000;
            if (delta > 20) {
                setImmediate(() => console.warn('Event loop blocked for ' + delta + ' ms at ' + cleanStack(ex.stack)));
            }
        }
    }
}).enable();

export function logContext(point: string) {
    debug.push(`CHECKPOINT: ${point} ${async_hooks.executionAsyncId()} | ${paths[async_hooks.executionAsyncId()]}`);
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

    withContext<P>(value: T | undefined, callback: () => P): P {
        let sourceAsyncId = async_hooks.executionAsyncId();
        let current = contexts[this.id][sourceAsyncId];
        if (value) {
            contexts[this.id][sourceAsyncId] = value;
        } else {
            delete contexts[this.id][sourceAsyncId];
        }
        let res: P;
        try {
            res = callback();
        } finally {
            if (current) {
                contexts[this.id][sourceAsyncId] = current;
            } else {
                delete contexts[this.id][sourceAsyncId];
            }
        }
        return res;
    }

    get value(): T | undefined {
        if (ENABLE_DEBUG) {
            debug.push(`read: ${async_hooks.executionAsyncId()}`);
        }
        return contexts[this.id][async_hooks.executionAsyncId()];
    }
}