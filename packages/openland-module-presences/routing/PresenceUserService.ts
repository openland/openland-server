import { inTx, getTransaction } from '@openland/foundationdb';
import { Modules } from 'openland-modules/Modules';
import { createNamedContext } from '@openland/context';
import { InvalidateSync } from '@openland/patterns';
import { EventBus, EventBusSubcription } from 'openland-module-pubsub/EventBus';
import { UserService } from 'openland-module-events/users/UserService';

const rootCtx = createNamedContext('presence');

export class PresenceUserService {
    readonly user: UserService;
    private subscription: EventBusSubcription | undefined;
    private sync: InvalidateSync;
    private canceled = false;

    constructor(user: UserService) {
        this.user = user;
        this.sync = new InvalidateSync(this.doSync);
    }

    async start() {
        this.sync.invalidate();
        this.subscription = EventBus.subscribe(`presences.users-notify.${this.user.uid}`, () => {
            this.sync.invalidate();
        });
    }

    doSync = async () => {
        if (this.canceled) {
            return;
        }
        let online = await inTx(rootCtx, async (ctx) => {
            let onlineData = await Modules.Presence.users.repo.getOnline(ctx, this.user.uid);
            let readVersiion = await getTransaction(ctx).getReadVersion();
            return { online: onlineData, readVersiion };
        });

        EventBus.publish(`presences.user.${this.user.uid}`, online.online);

        if (!online.online.lastSeen) {
            return;
        }
        if (online.online.lastSeen.timeout < Date.now()) {
            return;
        }
        let groups = this.user.getActiveGroups();
        for (let g of groups) {
            EventBus.publish(`presences.groups-notify.${g}`, { uid: this.user.uid, timeout: online.online.lastSeen.timeout, readVersiion: online.readVersiion.toString('hex') });
        }
    }

    async stop() {
        this.canceled = true;
        if (this.subscription) {
            this.subscription.cancel();
            this.subscription = undefined;
        }
    }
}