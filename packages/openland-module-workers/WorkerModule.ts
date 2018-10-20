import { startLegacyScheduller } from './legacy/LegacyScheduller';
import { ModernScheduller } from './modern/ModernScheduller';
import { ModernWorkQueue } from './modern/ModernWorkQueue';
import { delay } from 'openland-server/utils/timer';

export class WorkerModule {
    readonly scheduler = new ModernScheduller();

    readonly TestWorker = new ModernWorkQueue<{ value: number }, { value: number }>('sample');

    start = () => {
        startLegacyScheduller();
        this.scheduler.start();

        this.TestWorker.addWorker(async (args) => {
            await delay(1000);
            return { value: args.value * 2 };
        });
    }
}