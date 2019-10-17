import { ScheduledQueue } from '../../openland-module-workers/ScheduledQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { Modules } from '../../openland-modules/Modules';
import { buildMessage, heading } from '../../openland-utils/MessageBuilder';
import {
    alertIfRecord, buildDailyRecordAlert,
    getEngagementCounters,
    getEngagementReportsChatId,
    getSuperNotificationsBotId,
} from './utils';
import { createLogger } from '@openland/log';

const log = createLogger('weekly-engagement-report');
export function createDailyEngagementReportWorker() {
    let queue = new ScheduledQueue('daily-engagement', {
        interval: 'every-day', time: { hours: 10, minutes: 0 },
    });
    if (serverRoleEnabled('workers')) {
        queue.addWorker(async (parent) => {
            const chatId = await getEngagementReportsChatId(parent);
            const botId = await getSuperNotificationsBotId(parent);
            if (!chatId || !botId) {
                log.warn(parent, 'botId or chatId not specified');
                return { result: 'rejected' };
            }

            let counters = await getEngagementCounters(Date.now() - 24 * 60 * 60 * 1000);
            const report = [heading([
                `Daily`,
                `👩‍💻 ${counters.actives}`,
                `➡️ ${counters.senders}`,
                `✉️ ${counters.messagesSent}`,
                `❤️ ${counters.todayLikeGivers}`,
                `🙃 ${counters.todayLikeGetters}`
            ].join('   '))];

            await Modules.Messaging.sendMessage(parent, chatId!, botId!, {
                ...buildMessage(...report), ignoreAugmentation: true,
            });

            // check for records
            await alertIfRecord(
                parent,
                chatId,
                'engagement-daily-actives',
                counters.actives,
                buildDailyRecordAlert('Actives')
            );
            await alertIfRecord(
                parent,
                chatId,
                'engagement-daily-senders',
                counters.senders,
                buildDailyRecordAlert('Senders')
            );
            await alertIfRecord(
                parent,
                chatId,
                'engagement-daily-messages',
                counters.messagesSent,
                buildDailyRecordAlert('Sent messages')
            );
            await alertIfRecord(
                parent,
                chatId,
                'engagement-daily-like-givers',
                counters.todayLikeGivers,
                buildDailyRecordAlert('Today like givers')
            );
            await alertIfRecord(
                parent,
                chatId,
                'engagement-daily-like-getters',
                counters.todayLikeGetters,
                buildDailyRecordAlert('Today like getters')
            );

            return { result: 'completed' };
        });
    }
    return queue;
}