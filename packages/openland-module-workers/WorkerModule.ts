import { Store } from './../openland-module-db/FDB';
import { ShardingRepository } from './repo/ShardingRepository';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { ModernScheduller } from './scheduling/TaskScheduler';
import { injectable } from 'inversify';
import { startScheduler } from './scheduling/startScheduler';
import { startShardingScheduler } from './scheduling/startShardingScheduler';

@injectable()
export class WorkerModule {
    private readonly scheduler = new ModernScheduller();
    private readonly repo = new ShardingRepository(Store.ShardingDataDirectory);

    start = async () => {
        this.scheduler.start();
        if (serverRoleEnabled('admin')) {
            startScheduler();
            startShardingScheduler(this.repo);
        }
    }
}