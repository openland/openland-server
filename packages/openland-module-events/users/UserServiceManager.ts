import { KeepAliveService } from './KeepAliveService';
import { EventBus, EventBusSubcription } from 'openland-module-pubsub/EventBus';
import { getShardId } from 'openland-module-sharding/getShardId';
import { UserService } from './UserService';

export class UserServiceShard {
    private shard: number;
    private subscription!: EventBusSubcription;
    private services: KeepAliveService<number, UserService>;

    constructor(shard: number) {
        this.shard = shard;
        this.services = new KeepAliveService(15 * 60 * 1000, (uid) => new UserService(uid));
    }

    async init() {
        this.subscription = EventBus.subscribe('users.shard.' + this.shard + '.keep-alive', (src) => {
            let uid = src.uid as number;
            this.services.keepAlive(uid);
        });
    }

    async stop() {
        this.subscription.cancel();
        await this.services.close();
    }
}

export class UserServiceManager {

    private ringSize: number | null = null;
    private shard = new Map<number, UserServiceShard>();
    private keepAlive = new Map<number, number>();

    constructor() {
        setInterval(this.reportKeepAlives, 60 * 1000);
    }

    enableKeepAlive = (uid: number) => {
        this.reportKeepAlive(uid);
        let ex = this.keepAlive.get(uid) || 0;
        this.keepAlive.set(uid, ex + 1);
        return () => {
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
            return;
        }
        let shard = getShardId(uid, ringSize);
        EventBus.publish('users.shard.' + shard + '.keep-alive', { uid });
    }

    //
    // Sharding
    //

    createShard = async (key: number) => {
        let res = new UserServiceShard(key);
        await res.init();
        this.shard.set(key, res);
        return async () => {
            await res.stop();
            this.shard.delete(key);
        };
    }

    initSharding = (ringSize: number) => {
        this.ringSize = ringSize;
    }
}