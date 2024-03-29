import { Factory } from './Metrics';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { DistributedCollector } from './DistributedCollector';
// import { EventBus } from 'openland-module-pubsub/EventBus';
// import { getAllMetrics } from './Metric';
import { injectable } from 'inversify';
import { Config } from 'openland-config/Config';
// import { forever, delay } from 'openland-utils/timer';
// import { createNamedContext } from '@openland/context';
// import { logger } from 'openland-server/logs';

const isProduction = Config.environment;

@injectable()
export class MonitoringModule {

    private collector!: DistributedCollector;

    start = async () => {
        if (!isProduction) {
            return;
        }

        if (serverRoleEnabled('admin')) {
            this.collector = new DistributedCollector(Factory);
        }

        // Start reporting
        Factory.start();
    }

    getPrometheusReport = async () => {
        if (this.collector) {
            return await this.collector.getPrometheusReport();
        } else {
            return '';
        }
    }
}