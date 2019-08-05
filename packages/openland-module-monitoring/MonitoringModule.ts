import { getAllMetrics } from './Metric';
import { injectable } from 'inversify';
import { forever, delay } from 'openland-utils/timer';
import { createNamedContext } from '@openland/context';
import { logger } from 'openland-server/logs';

const isProduction = process.env.NODE_ENV === 'production';

@injectable()
export class MonitoringModule {

    start = async () => {
        if (!isProduction) {
            return;
        }
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