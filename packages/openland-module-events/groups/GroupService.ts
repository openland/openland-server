import { Metrics } from 'openland-module-monitoring/Metrics';
export class GroupService {
    readonly cid: number;

    constructor(cid: number) {
        this.cid = cid;
    }

    async start() {
        Metrics.GroupActiveServices.inc();
    }

    async stop() {
        Metrics.GroupActiveServices.dec();
    }
}
