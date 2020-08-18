import { EventBus, EventBusSubcription } from 'openland-module-pubsub/EventBus';
import { UserService } from 'openland-module-events/users/UserService';

export class PresenceUserService {
    readonly user: UserService;
    private subscription: EventBusSubcription | undefined;

    constructor(user: UserService) {
        this.user = user;
    }

    async start() {
        this.subscription = EventBus.subscribe(`presences.users-notify.${this.user.uid}`, (data) => {
            let timeout = data.timeout as number;
            // let active = data.active as string;
            // let tid = data.tid as string;
            let groups = this.user.getActiveGroups();
            for (let g of groups) {
                EventBus.publish(`presences.groups-notify.${g}`, { uid: this.user.uid, timeout: timeout });
            }
        });
    }

    async stop() {
        if (this.subscription) {
            this.subscription.cancel();
            this.subscription = undefined;
        }
    }
}