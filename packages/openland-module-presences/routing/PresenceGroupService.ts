import { EventBus, EventBusSubcription } from 'openland-module-pubsub/EventBus';
import { GroupService } from 'openland-module-events/groups/GroupService';
import { throttle } from 'openland-utils/timer';

export class PresenceGroupService {
    private group: GroupService;
    private subscription: EventBusSubcription | undefined;
    private online = 0;
    private users = new Map<number, number>();
    private stopped = false;

    constructor(group: GroupService) {
        this.group = group;
    }

    async start() {
        this.subscription = EventBus.subscribe(`presences.groups-notify.${this.group.cid}`, (data) => {
            let uid = data.uid as number;
            let timeout = (data.timeout as number) - Date.now();
            if (timeout <= 0) {
                return;
            }

            if (this.users.has(uid)) {
                let ex = this.users.get(uid)!;
                this.users.set(uid, ex + 1);
            } else {
                this.users.set(uid, 1);
                this.online++;
                this.notifyOnlineStatus();
            }

            setTimeout(() => {
                let ex = this.users.get(uid);
                if (ex !== undefined) {
                    if (ex > 1) {
                        this.users.set(uid, ex - 1);
                    } else {
                        this.users.delete(uid);
                        this.online--;
                        this.notifyOnlineStatus();
                    }
                }
            }, timeout);
        });

        // Send initial timeout after 5 seconds since group will probabbly gather all 
        // presences by this point
        setTimeout(() => {
            this.notifyOnlineStatus();
        }, 5000);
    }

    getOnline() {
        return this.online;
    }

    private notifyOnlineStatus = throttle(2000, () => {
        if (this.stopped) {
            return;
        }
        EventBus.publish(`presences.group.${this.group.cid}`, { online: this.online });
    });

    async stop() {
        this.stopped = true;
        if (this.subscription) {
            this.subscription.cancel();
            this.subscription = undefined;
        }
    }
}