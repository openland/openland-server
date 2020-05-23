import { ModernScheduller } from './src/TaskScheduler';
import { injectable } from 'inversify';

@injectable()
export class WorkerModule {
    private readonly scheduler = new ModernScheduller();

    start = async () => {
        this.scheduler.start();
    }
}