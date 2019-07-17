import { ScheduledQueue, WeekDay } from '../../openland-module-workers/ScheduledQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { getEngagementReportsChatId, getSuperNotificationsBotId } from './utils';
import { createLogger } from '@openland/log';

const log = createLogger('weekly-engagement-report');

export function createWeeklyEngagementReportWorker() {
    let queue = new ScheduledQueue('weekly-engagement', {
        interval: 'every-week', time: { weekDay: WeekDay.Monday, hours: 10, minutes: 0 },
    });

    if (serverRoleEnabled('workers')) {
        queue.addWorker(async (parent) => {
            const chatId = await getEngagementReportsChatId(parent);
            const botId = await getSuperNotificationsBotId(parent);
            if (!chatId || !botId) {
                log.warn(parent, 'botId or chatId not specified');
                return { result: 'rejected' };
            }

            return { result: 'completed' };
        });
    }
    return queue;

}