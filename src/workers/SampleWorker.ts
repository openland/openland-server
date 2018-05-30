import { WorkQueue } from '../modules/workerQueue';
import { delay } from '../utils/timer';

export function createSampleWorker() {
    let queue = new WorkQueue<{ someArgument: number }, { multiplied: number }>('sampleTask');
    queue.addWorker(async (item) => {
        delay(5000);
        return { multiplied: item.someArgument * 2 };
    });
    return queue;
}