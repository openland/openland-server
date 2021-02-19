import { TypedEventsMediator } from './mediators/TypedEventsMediator';
import { createLogger } from '@openland/log';
import { createNamedContext, Context } from '@openland/context';
import { UserServiceManager } from './users/UserServiceManager';
import { ShardRegion } from 'openland-module-sharding/ShardRegion';
import { injectable } from 'inversify';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { GroupServiceManager } from './groups/GroupServiceManager';
import { CommonEvent, ChatEvent, FeedEvent } from './Definitions';

const root = createNamedContext('user-service');
const log = createLogger('user-service');

@injectable()
export class EventsModule {

    readonly userSharding = new ShardRegion('users', 128);
    readonly groupSharding = new ShardRegion('groups', 128);
    readonly userService = new UserServiceManager();
    readonly groupService = new GroupServiceManager();
    readonly mediator = new TypedEventsMediator();

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

    //
    // Posting
    //

    postToCommon = async (ctx: Context, uid: number, update: CommonEvent) => {
        await this.mediator.postToCommon(ctx, uid, update);
    }

    async postToChat(ctx: Context, cid: number, event: ChatEvent) {
        await this.mediator.postToChat(ctx, cid, event);
    }

    async postToChatPrivate(ctx: Context, cid: number, uid: number, event: ChatEvent) {
        await this.mediator.postToChatPrivate(ctx, cid, uid, event);
    }

    async postToFeedTopic(ctx: Context, tid: number, event: FeedEvent) {
        await this.mediator.postToFeedTopic(ctx, tid, event);
    }

    //
    // Handling
    //

    onUserCreated = async (ctx: Context, uid: number) => {
        await this.mediator.prepareUser(ctx, uid);
    }

    onUserDeleted = async (ctx: Context, uid: number) => {
        // Nothing to do?
    }
}