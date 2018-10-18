import { WorkQueue } from '../../openland-module-workers/workerQueue';
import { delay } from '../utils/timer';

export function createSampleWorker() {
    let queue = new WorkQueue<{ someArgument: number }, { multiplied: number }>('sampleTask');
    queue.addWorker(async (item) => {
        await delay(5000);
        return { multiplied: item.someArgument * 2 };
    });
    return queue;
}