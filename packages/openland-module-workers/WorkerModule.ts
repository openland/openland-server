import { ModernScheduller } from './src/TaskScheduler';
import { WorkQueue } from './WorkQueue';
import { delay } from 'openland-utils/timer';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';

export class WorkerModule {

    readonly TestWorker = new WorkQueue<{ value: number }, { value: number }>('sample');
    private readonly scheduler = new ModernScheduller();

    start = () => {
        this.scheduler.start();

        if (serverRoleEnabled('workers')) {
            this.TestWorker.addWorker(async (args) => {
                await delay(1000);
                return { value: args.value * 2 };
            });
        }
    }
}