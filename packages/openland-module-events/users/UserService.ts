import { GroupServiceProxy } from './GroupServiceProxy';
import { Modules } from 'openland-modules/Modules';
import { inTx, Watch } from '@openland/foundationdb';
import { TypingService } from './../../openland-module-typings/TypingService';
import { AsyncLock, backoff, asyncRun } from 'openland-utils/timer';
import { createNamedContext } from '@openland/context';
import { Metrics } from 'openland-module-monitoring/Metrics';

const root = createNamedContext('user-service');

export class UserService {
    readonly uid: number;
    readonly lock = new AsyncLock();
    private canceled = false;
    private readonly serviceTyping: TypingService;
    private readonly serviceGroups: GroupServiceProxy;
    private groupsWatch: Watch | null = null;
    private activeGroups: number[] = [];

    constructor(uid: number) {
        this.uid = uid;
        Metrics.UserActiveServices.inc();

        this.serviceTyping = new TypingService(this);
        this.serviceGroups = new GroupServiceProxy(this);

        // tslint:disable-next-line:no-floating-promises
        this.lock.inLock(this.start);
    }

    getActiveGroups(): number[] {
        return this.activeGroups;
    }

    private start = async () => {

        // Load initial groups
        let initial = await backoff(root, async () => {
            return await inTx(root, async (ctx) => {
                let groups = await Modules.Messaging.room.getUserGroups(ctx, this.uid);
                let watch = await Modules.Messaging.room.watchUserGroups(ctx, this.uid);
                return {
                    groups,
                    watch
                };
            });
        });
        this.activeGroups = initial.groups;
        this.groupsWatch = initial.watch;

        // Refresh loop
        asyncRun(async () => {
            await backoff(root, async () => {
                while (!this.canceled) {

                    if (this.groupsWatch) {
                        await this.groupsWatch.promise;
                        this.groupsWatch = null;
                    }

                    let updated = await inTx(root, async (ctx) => {
                        let groups = await Modules.Messaging.room.getUserGroups(ctx, this.uid);
                        let watch = await Modules.Messaging.room.watchUserGroups(ctx, this.uid);
                        return {
                            groups,
                            watch
                        };
                    });
                    if (this.canceled) {
                        updated.watch.cancel();
                        return;
                    }
                    this.groupsWatch = updated.watch;
                    this.onGroupsChanged(updated.groups);
                }
            });
        });

        // Start services
        await this.serviceTyping.start();
        await this.serviceGroups.start();
    }

    private onGroupsChanged = (groups: number[]) => {
        this.activeGroups = groups;

        // Update services
        this.serviceTyping.onGroupsChanged(groups);
        this.serviceGroups.onGroupsChanged(groups);
    }

    async stop() {
        await this.lock.inLock(async () => {
            // Mark as canceled
            this.canceled = true;

            // Cancel watch
            if (this.groupsWatch) {
                this.groupsWatch.cancel();
                this.groupsWatch = null;
            }

            // Stop services
            await this.serviceTyping.stop();
            await this.serviceGroups.stop();

            // Update metrics
            Metrics.UserActiveServices.dec();
        });
    }
}