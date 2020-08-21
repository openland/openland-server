import { Store } from './../openland-module-db/FDB';
import { createLogger } from '@openland/log';
import { createNamedContext } from '@openland/context';
import { UserServiceManager } from './users/UserServiceManager';
import { ShardRegion } from 'openland-module-sharding/ShardRegion';
import { injectable } from 'inversify';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { GroupServiceManager } from './groups/GroupServiceManager';
import { EventsStorage } from './repo/EventsStorage';

const root = createNamedContext('user-service');
const log = createLogger('user-service');

@injectable()
export class EventsModule {

    readonly storage = new EventsStorage(Store.EventStorageDirectory);
    readonly userSharding = new ShardRegion('users', 128);
    readonly groupSharding = new ShardRegion('groups', 128);
    readonly userService = new UserServiceManager();
    readonly groupService = new GroupServiceManager();

    start = async () => {
        this.userSharding.start();
        this.groupSharding.start();

        log.debug(root, 'Loading sharding info...');
        let usersSharding = await this.userSharding.getShardingInfo();
        let groupsSharding = await this.groupSharding.getShardingInfo();
        log.debug(root, 'Sharding info loaded...');
        this.userService.initSharding(usersSharding.ringSize);
        this.groupService.initSharding(groupsSharding.ringSize);
        if (serverRoleEnabled('events')) {
            this.userSharding.startShard(this.userService.createShard);
            this.groupSharding.startShard(this.groupService.createShard);
        }
    }
}