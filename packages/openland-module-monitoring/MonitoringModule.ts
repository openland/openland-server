import { getAllMetrics } from './Metric';
import { injectable } from 'inversify';
import { forever, delay } from 'openland-utils/timer';
import { createNamedContext } from '@openland/context';
import { logger } from 'openland-server/logs';

@injectable()
export class MonitoringModule {

    start = async () => {
        forever(createNamedContext('monitoring'), async () => {
            while (true) {
                await delay(15000);

                let metrics = getAllMetrics();
                logger.info({
                    report: 'metric',
                    metric: 'all',
                    metrics
                });
            }
        });
    }
}