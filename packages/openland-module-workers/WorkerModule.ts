import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { ModernScheduller } from './scheduling/TaskScheduler';
import { injectable } from 'inversify';
import { startScheduler } from './scheduling/startScheduler';

@injectable()
export class WorkerModule {
    private readonly scheduler = new ModernScheduller();

    start = async () => {
        this.scheduler.start();
        if (serverRoleEnabled('admin')) {
            startScheduler();
        }
    }
}