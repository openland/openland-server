import { WorkQueue } from '../modules/workerQueue';
import { delay } from '../utils/timer';

// import { LockProvider, DynamicLock } from '../modules/dynamicLocking';
// import { delay } from '../utils/timer';

// class EmptyLock implements LockProvider {
//     async lock(seed: string) {
//         console.warn(`[${seed}] lock`);
//         return true;
//     }
//     async unlock(seed: string) {
//         console.warn(`[${seed}] unlock`);
//         return true;
//     }
//     async refresh(seed: string) {
//         console.warn(`[${seed}] refresh start`);
//         await delay(1500);
//         console.warn(`[${seed}] refresh end`);
//         return true;
//     }
// }
let queue = new WorkQueue<{ key: number }>('testTask');
export async function initWorkers() {
    queue.addWorker((item) => {
        console.warn(item);
    });

    // await delay(100);

    // for (let i = 0; i < 10; i++) {
    //     console.log('Work Item: ' + i);
    //     queue.pushWork({ key: i });
    //     await delay(1000);
    // }
    // let lock = new DynamicLock({
    //     refreshInterval: 1000,
    //     lockTimeout: 10000
    // });
    // lock.within(new EmptyLock(), async () => {
    //     for (let i = 0; i < 10; i++) {
    //         console.log('Work Item: ' + i);
    //         await delay(1000);
    //     }
    //     throw Error('Sample');
    // });
}