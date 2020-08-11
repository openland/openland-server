import { asyncRun } from 'openland-utils/timer';
import { UserServiceManager } from './users/UserServiceManager';
import { ShardRegion } from 'openland-module-sharding/ShardRegion';
import { injectable } from 'inversify';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';

@injectable()
export class EventsModule {

    readonly userSharding = new ShardRegion('users', 128);
    readonly userService = new UserServiceManager();

    start = async () => {
        if (serverRoleEnabled('events')) {
            this.userSharding.start();
            asyncRun(async () => {
                let shardInfo = await this.userSharding.getShardingInfo();
                this.userService.initSharding(shardInfo.ringSize);
                this.userSharding.startShard(this.userService.createShard);
            });
        }
    }
}