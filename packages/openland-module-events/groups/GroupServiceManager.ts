import { asyncRun } from 'openland-utils/timer';
import { KeepAliveService } from './../utils/KeepAliveService';
import { EventBus, EventBusSubcription } from 'openland-module-pubsub/EventBus';
import { GroupService } from './GroupService';
import { getShardId } from 'openland-module-sharding/getShardId';
import { NATS, NatsSubscription } from 'openland-module-pubsub/NATS';

export class GroupServiceShard {
    private shard: number;
    private subscription!: EventBusSubcription;
    private getOnlineSubscription!: NatsSubscription;
    private services: KeepAliveService<number, GroupService>;

    constructor(shard: number) {
        this.shard = shard;
        this.services = new KeepAliveService(60 * 1000, (uid) => new GroupService(uid));
    }

    async init() {
        this.subscription = EventBus.subscribe('groups.shard.' + this.shard + '.keep-alive', (src) => {
            let cid = src.cid as number;
            this.services.keepAlive(cid);
        });
        this.getOnlineSubscription = NATS.subscribe(`groups.shard.${this.shard}.get-online`, (e) => {
            asyncRun(async () => {
                let cid = e.data.cid as number;
                let res = await this.services.getService(cid);
                if (!res) {
                    return;
                }
                let online = res.online;
                if (e.reply) {
                    NATS.post(e.reply, { online });
                }
            });
        });
    }

    async stop() {
        this.subscription.cancel();
        this.getOnlineSubscription.cancel();
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

    getOnline = async (cid: number) => {
        if (this.ringSize === null) {
            throw Error('Ring is not inited');
        }
        let shard = getShardId(cid, this.ringSize);
        try {
            let res = await NATS.request(`groups.shard.${shard}.get-online`, 5000, { cid });
            return res.online || 0;
        } catch (e) {
            return 0;
        }
    }

    private reportKeepAlives = () => {
        let cids = [...this.keepAlive.keys()];
        for (let u of cids) {
            this.reportKeepAlive(u);
        }
    }

    private reportKeepAlive = (cid: number) => {
        let ringSize = this.ringSize;
        if (ringSize === null) {
            // log.log(root, 'Unable to report keepalive for user #' + uid);
            return;
        }
        let shard = getShardId(cid, ringSize);
        EventBus.publish('groups.shard.' + shard + '.keep-alive', { cid });
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