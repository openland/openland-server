import { AsyncLock } from 'openland-utils/timer';
import { Metrics } from 'openland-module-monitoring/Metrics';
import { PresenceGroupService } from 'openland-module-presences/routing/PresenceGroupService';

export class GroupService {
    readonly cid: number;
    readonly lock = new AsyncLock();
    readonly presencesService: PresenceGroupService;

    constructor(cid: number) {
        this.cid = cid;

        this.presencesService = new PresenceGroupService(this);

        // tslint:disable-next-line:no-floating-promises
        this.lock.inLock(this.start);
    }

    private async start() {
        Metrics.GroupActiveServices.inc();

        // Start services
        await this.presencesService.start();
    }

    get online() {
        return this.presencesService.getOnline();
    }

    async stop() {
        await this.lock.inLock(async () => {

            // Stop services
            await this.presencesService.stop();

            Metrics.GroupActiveServices.dec();
        });
    }
}
