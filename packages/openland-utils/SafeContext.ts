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
    private static namespace = cls.createNamespace('safe-context');
    private readonly id = SafeContext.nextId++;

    static inNewContext<P>(callback: () => P): P {
        return SafeContext.namespace.bind(callback, {})();
    }

    constructor() {
        //
    }

    withContext<P>(value: T | undefined, callback: () => P): P {
        return SafeContext.namespace.runAndReturn(() => {
            SafeContext.namespace.set('value-' + this.id, value);
            return callback();
        });
    }

    get value(): T | undefined {
        return SafeContext.namespace.get('value-' + this.id);
        // if (ENABLE_DEBUG) {
        //     debug.push(`read: ${async_hooks.executionAsyncId()}`);
        // }
        // return contexts[this.id][async_hooks.executionAsyncId()];
    }
}