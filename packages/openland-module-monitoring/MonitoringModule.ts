// import { EventBus } from 'openland-module-pubsub/EventBus';
// import { getAllMetrics } from './Metric';
import { injectable } from 'inversify';
// import { forever, delay } from 'openland-utils/timer';
// import { createNamedContext } from '@openland/context';
// import { logger } from 'openland-server/logs';

const isProduction = process.env.NODE_ENV === 'production';

@injectable()
export class MonitoringModule {

    start = async () => {
        if (!isProduction) {
            return;
        }
        // forever(createNamedContext('monitoring'), async () => {
        //     while (true) {
        //         await delay(15000);

        //         let metrics = getAllMetrics();
        //         logger.info({
        //             message: 'Metrics report',
        //             report: 'metric',
        //             context: 'all',
        //             metrics: metrics.global
        //         });
        //         for (let c in metrics.context) {
        //             logger.info({
        //                 message: 'Metrics report',
        //                 report: 'metric',
        //                 context: c,
        //                 metrics: metrics.context[c]
        //             });
        //         }
        //     }
        // });
    }

    // reportInFlight = (name: string, key: string, timeout: number) => {
    //     EventBus.publish('metric', { name, key, timeout });
    // }
}