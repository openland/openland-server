import { Modules } from 'openland-modules/Modules';
import { UserService } from './UserService';

export class GroupServiceProxy {
    readonly user: UserService;
    private keepAlive = new Map<number, () => void>();

    constructor(user: UserService) {
        this.user = user;
    }

    onGroupsChanged = (groups: number[]) => {
        for (let g of groups) {
            if (!this.keepAlive.has(g)) {
                this.keepAlive.set(g, Modules.Events.groupService.enableKeepAlive(g));
            }
        }

        // Remove left groups
        for (let g of [...this.keepAlive.entries()]) {
            if (!groups.find((v) => v === g[0])) {
                g[1]();
                this.keepAlive.delete(g[0]);
            }
        }
    }

    async start() {
        this.onGroupsChanged(this.user.getActiveGroups());
    }

    async stop() {
        this.onGroupsChanged([]);
    }
}