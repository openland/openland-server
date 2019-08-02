import { getAllMetrics } from './Metric';
import { injectable } from 'inversify';
import { forever, delay } from 'openland-utils/timer';
import { createNamedContext } from '@openland/context';
import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
let log = pino();
log.level = 'debug';

@injectable()
export class MonitoringModule {

    start = async () => {
        if (isProduction) {
            forever(createNamedContext('monitoring'), async () => {
                while (true) {
                    await delay(15000);

                    let metrics = getAllMetrics();
                    log.info({
                        report: 'metric',
                        metric: 'all',
                        metrics
                    });
                }
            });
        }
    }
}