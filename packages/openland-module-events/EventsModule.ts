import { createLogger } from '@openland/log';
import { createNamedContext } from '@openland/context';
import { asyncRun } from 'openland-utils/timer';
import { UserServiceManager } from './users/UserServiceManager';
import { ShardRegion } from 'openland-module-sharding/ShardRegion';
import { injectable } from 'inversify';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';

const root = createNamedContext('user-service');
const log = createLogger('user-service');

@injectable()
export class EventsModule {

    readonly userSharding = new ShardRegion('users', 128);
    readonly userService = new UserServiceManager();

    start = async () => {
        this.userSharding.start();
        if (serverRoleEnabled('workers')) {
            asyncRun(async () => {
                log.debug(root, 'Loading sharding info...');
                let shardInfo = await this.userSharding.getShardingInfo();
                log.debug(root, 'Sharding info loaded...');
                this.userService.initSharding(shardInfo.ringSize);
                this.userSharding.startShard(this.userService.createShard);
            });
        }
    }
}