import { ModernScheduller } from './src/TaskScheduler';
import { WorkQueue } from './WorkQueue';
import { delay } from 'openland-server/utils/timer';

export class WorkerModule {

    readonly TestWorker = new WorkQueue<{ value: number }, { value: number }>('sample');
    private readonly scheduler = new ModernScheduller();

    start = () => {
        this.scheduler.start();

        this.TestWorker.addWorker(async (args) => {
            await delay(1000);
            return { value: args.value * 2 };
        });
    }
}