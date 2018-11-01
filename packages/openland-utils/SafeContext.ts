import cls from 'cls-hooked';
// import async_hooks from 'async_hooks';
// const ENABLE_DEBUG = false;

// let contexts: any[] = [];
// let paths: any = {};
// let debug: string[] = [];
// contexts[-1] = {};
// async_hooks.createHook({
//     init: (asyncId, type, triggerAsyncId, resource) => {
//         if (ENABLE_DEBUG) {
//             debug.push(`INIT ${asyncId} ${type} ${triggerAsyncId} ${async_hooks.executionAsyncId()}`);
//         }

//         let currentId = async_hooks.executionAsyncId();

//         // contexts[-1][asyncId] = {};

//         // JS based callback/promise
//         if (currentId !== 0) {
//             if (ENABLE_DEBUG) {
//                 if (paths[currentId]) {
//                     paths[asyncId] = [...paths[currentId], asyncId];
//                 } else {
//                     paths[asyncId] = [asyncId];
//                 }
//             }
//             for (let ctxId in contexts) {
//                 let ctx = contexts[ctxId];
//                 let value = ctx[currentId];
//                 if (value) {
//                     if (ENABLE_DEBUG) {
//                         debug.push(`CONTEXT FOUND ${ctxId}.${currentId}`);
//                     }
//                     ctx[asyncId] = value;
//                 }
//             }
//             return;
//         }
//     },
//     destroy: (asyncId) => {
//         for (let ctxId in contexts) {
//             contexts[ctxId][asyncId] = undefined;
//         }
//     },
// }).enable();

export function logContext(point: string) {
    // debug.push(`CHECKPOINT: ${point} ${async_hooks.executionAsyncId()} | ${paths[async_hooks.executionAsyncId()]}`);
}

export function exportContextDebug() {
    // let d = debug;
    // debug = [];
    // console.log(d.join('\n'));
}

export class SafeContext<T> {
    private static nextId = 0;
    private readonly id = SafeContext.nextId++;
    private readonly namespace: cls.Namespace;

    constructor() {
        this.namespace = cls.createNamespace('opl-' + this.id);
        // contexts.push({});
    }

    withContext<P>(value: T | undefined, callback: () => P): P {
        return this.namespace.runAndReturn(() => {
            this.namespace.set('value', value);
            return callback();
        });
        // let sourceAsyncId = async_hooks.executionAsyncId();
        // let current = contexts[this.id][sourceAsyncId];
        // if (value) {
        //     contexts[this.id][sourceAsyncId] = value;
        // } else {
        //     contexts[this.id][sourceAsyncId] = undefined;
        // }
        // let res: P;
        // try {
        //     res = callback();
        // } finally {
        //     if (current) {
        //         contexts[this.id][sourceAsyncId] = current;
        //     } else {
        //         contexts[this.id][sourceAsyncId] = undefined;
        //     }
        // }
        // return res;
    }

    get value(): T | undefined {
        return this.namespace.get('value');
        // if (ENABLE_DEBUG) {
        //     debug.push(`read: ${async_hooks.executionAsyncId()}`);
        // }
        // return contexts[this.id][async_hooks.executionAsyncId()];
    }
}