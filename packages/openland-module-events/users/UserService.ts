import os from 'os';
import { Metrics } from 'openland-module-monitoring/Metrics';

const hostname = os.hostname();

export class UserService {
    readonly uid: number;

    constructor(uid: number) {
        this.uid = uid;
        Metrics.UserServices.inc(hostname);
    }

    async stop() {
        Metrics.UserServices.dec(hostname);
    }
}