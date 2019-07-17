import { inTx } from '@openland/foundationdb';
import { ScheduledQueue } from '../../openland-module-workers/ScheduledQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';

export function createDailyEngagementReportWorker() {
    let queue = new ScheduledQueue('daily-engagement', {
        interval: 'every-day',
        time: { hours: 10, minutes: 0 },
    });
    if (serverRoleEnabled('workers')) {
        queue.addWorker(async (parent) => {
            return await inTx(parent, async ctx => {
                return { result: 'completed' };
            });
        });
    }
    return queue;
}