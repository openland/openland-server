import { createLogger } from '@openland/log';
import { createNamedContext } from '@openland/context';
import { Metrics } from 'openland-module-monitoring/Metrics';

const root = createNamedContext('user-service');
const log = createLogger('service');

export class UserService {
    readonly uid: number;

    constructor(uid: number) {
        this.uid = uid;
        Metrics.UserActiveServices.inc();
        log.log(root, 'Start service for user ' + uid);
    }

    async stop() {
        Metrics.UserActiveServices.dec();
        log.log(root, 'Stop service for user ' + this.uid);
    }
}