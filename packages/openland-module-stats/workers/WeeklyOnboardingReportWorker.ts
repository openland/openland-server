import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { Modules } from '../../openland-modules/Modules';
import { ScheduledQueue, WeekDay } from '../../openland-module-workers/ScheduledQueue';
import { buildMessage, heading } from '../../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';
import {
    alertIfRecord, buildWeeklyRecordAlert,
    getOnboardingCounters,
    getOnboardingReportsChatId,
    getSuperNotificationsBotId,
} from './utils';

const log = createLogger('weekly-onboarding-report');

export function createWeeklyOnboardingReportWorker() {
    let queue = new ScheduledQueue('weekly-onboarding', {
        interval: 'every-week',
        time: { weekDay: WeekDay.Monday, hours: 10, minutes: 0 },
    });
    if (serverRoleEnabled('workers')) {
        queue.addWorker( async (parent) => {
            const chatId = await getOnboardingReportsChatId(parent);
            const botId = await getSuperNotificationsBotId(parent);
            if (!chatId || !botId) {
                log.warn(parent, 'botId or chatId not specified');
                return;
            }

            let counters = await getOnboardingCounters(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const report = [heading([
                `Weekly`,
                `🐥 ${counters.newUserEntrances}`,
                `📱 ${counters.newMobileUsers}`,
                `➡️ ${counters.newSenders}`,
                `🙌 ${counters.newInviters}`,
                `🗣 ${counters.newAboutFillers}`,
                `❤️ ${counters.newThreeLikeGivers}`,
                `🙃 ${counters.newThreeLikeGetters}`
            ].join('   '))];

            await Modules.Messaging.sendMessage(parent, chatId!, botId!, {
                ...buildMessage(...report), ignoreAugmentation: true,
            });

            // check for records
            await alertIfRecord(
                parent,
                chatId,
                'onboarding-weekly-user-entrances',
                counters.newUserEntrances,
                buildWeeklyRecordAlert('New user entrances')
            );
            await alertIfRecord(
                parent,
                chatId,
                'onboarding-weekly-mobile-users',
                counters.newMobileUsers,
                buildWeeklyRecordAlert('New mobile users')
            );
            await alertIfRecord(
                parent,
                chatId,
                'onboarding-weekly-senders',
                counters.newSenders,
                buildWeeklyRecordAlert('New senders')
            );
            await alertIfRecord(
                parent,
                chatId,
                'onboarding-weekly-inviters',
                counters.newInviters,
                buildWeeklyRecordAlert('New inviters')
            );
            await alertIfRecord(
                parent,
                chatId,
                'onboarding-weekly-about-fillers',
                counters.newAboutFillers,
                buildWeeklyRecordAlert('New about fillers')
            );
            await alertIfRecord(
                parent,
                chatId,
                'onboarding-weekly-like-givers',
                counters.newThreeLikeGivers,
                buildWeeklyRecordAlert('New three like givers')
            );
            await alertIfRecord(
                parent,
                chatId,
                'onboarding-weekly-like-getters',
                counters.newThreeLikeGetters,
                buildWeeklyRecordAlert('New three like getters')
            );
        });
    }
    return queue;
}