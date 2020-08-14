import { KeepAliveService } from './../utils/KeepAliveService';
import { EventBus, EventBusSubcription } from 'openland-module-pubsub/EventBus';
import { GroupService } from './GroupService';
import { getShardId } from 'openland-module-sharding/getShardId';

export class GroupServiceShard {
    private shard: number;
    private subscription!: EventBusSubcription;
    private services: KeepAliveService<number, GroupService>;

    constructor(shard: number) {
        this.shard = shard;
        this.services = new KeepAliveService(60 * 1000, (uid) => new GroupService(uid));
    }

    async init() {
        this.subscription = EventBus.subscribe('groups.shard.' + this.shard + '.keep-alive', (src) => {
            let uid = src.uid as number;
            this.services.keepAlive(uid);
        });
    }

    async stop() {
        this.subscription.cancel();
        await this.services.close();
    }
}

export class GroupServiceManager {

    private ringSize: number | null = null;
    private shard = new Map<number, GroupServiceShard>();
    private keepAlive = new Map<number, number>();

    enableKeepAlive = (uid: number) => {
        // log.log(root, 'Enable keepalive for user #' + uid);
        this.reportKeepAlive(uid);
        let ex = this.keepAlive.get(uid) || 0;
        this.keepAlive.set(uid, ex + 1);
        return () => {
            // log.log(root, 'Disable keepalive for user #' + uid);
            let vc = this.keepAlive.get(uid);
            if (vc !== undefined) {
                if (vc <= 1) {
                    this.keepAlive.delete(uid);
                }
                this.keepAlive.set(uid, vc - 1);
            }
        };
    }

    private reportKeepAlives = () => {
        let uids = [...this.keepAlive.keys()];
        for (let u of uids) {
            this.reportKeepAlive(u);
        }
    }

    private reportKeepAlive = (uid: number) => {
        let ringSize = this.ringSize;
        if (ringSize === null) {
            // log.log(root, 'Unable to report keepalive for user #' + uid);
            return;
        }
        let shard = getShardId(uid, ringSize);
        EventBus.publish('groups.shard.' + shard + '.keep-alive', { uid });
        // log.debug(root, 'Report keepalive for user #' + uid + ' -> ' + shard);
    }

    //
    // Sharding
    //

    createShard = async (key: number) => {
        let res = new GroupServiceShard(key);
        await res.init();
        this.shard.set(key, res);
        return async () => {
            await res.stop();
            this.shard.delete(key);
        };
    }

    initSharding = (ringSize: number) => {
        // log.log(root, 'Initing sharding with ring size ' + ringSize);
        this.ringSize = ringSize;
        this.reportKeepAlives();
        setInterval(this.reportKeepAlives, 5 * 1000);
    }
}