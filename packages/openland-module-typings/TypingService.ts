import { EventBus, EventBusSubcription } from 'openland-module-pubsub/EventBus';
import { UserService } from 'openland-module-events/users/UserService';
import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import TypingTypeRoot = GQLRoots.TypingTypeRoot;

export class TypingService {
    private readonly user: UserService;
    private readonly groups = new Map<number, EventBusSubcription>();

    constructor(user: UserService) {
        this.user = user;
    }

    start = async () => {
        this.onGroupsChanged(this.user.getActiveGroups());
    }

    onGroupsChanged = (groups: number[]) => {

        // Add new groups
        for (let g of groups) {
            if (!this.groups.has(g)) {
                this.groups.set(g, EventBus.subscribe('ephemeral', 'group.' + g + '.typings', (body) => {
                    let cid = body.cid as number;
                    let uid = body.uid as number;
                    let type = body.type as TypingTypeRoot;
                    let cancel = body.type as boolean;
                    EventBus.publish('ephemeral', 'user.' + this.user.uid + '.typings', { cid, type, uid, cancel });
                }));
            }
        }

        // Remove left groups
        for (let g of [...this.groups.entries()]) {
            if (!groups.find((v) => v === g[0])) {
                g[1].cancel();
                this.groups.delete(g[0]);
            }
        }
    }

    stop = async () => {
        // Clear subscriptions
        this.onGroupsChanged([]);
    }
}