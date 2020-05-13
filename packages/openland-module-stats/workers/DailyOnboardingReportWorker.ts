import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { Modules } from '../../openland-modules/Modules';
import { ScheduledQueue } from '../../openland-module-workers/ScheduledQueue';
import {
    alertIfRecord, buildDailyRecordAlert,
    getOnboardingCounters,
    getOnboardingReportsChatId,
    getSuperNotificationsBotId,
} from './utils';
import { buildMessage, heading } from '../../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';

const log = createLogger('daily-onboarding-report');

export function createDailyOnboardingReportWorker() {
    let queue = new ScheduledQueue('daily-onboarding', {
        interval: 'every-day', time: { hours: 10, minutes: 0 },
    });
    if (serverRoleEnabled('workers')) {
        queue.addWorker(async (parent) => {
            const chatId = await getOnboardingReportsChatId(parent);
            const botId = await getSuperNotificationsBotId(parent);
            if (!chatId || !botId) {
                log.warn(parent, 'botId or chatId not specified');
                return;
            }

            let counters = await getOnboardingCounters(Date.now() - 24 * 60 * 60 * 1000);
            const report = [heading([
                `Daily`,
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
                'onboarding-daily-user-entrances',
                counters.newUserEntrances,
                buildDailyRecordAlert('New user entrances')
            );
            await alertIfRecord(
                parent,
                chatId,
                'onboarding-daily-mobile-users',
                counters.newMobileUsers,
                buildDailyRecordAlert('New mobile users')
            );
            await alertIfRecord(
                parent,
                chatId,
                'onboarding-daily-senders',
                counters.newSenders,
                buildDailyRecordAlert('New senders')
            );
            await alertIfRecord(
                parent,
                chatId,
                'onboarding-daily-inviters',
                counters.newInviters,
                buildDailyRecordAlert('New inviters')
            );
            await alertIfRecord(
                parent,
                chatId,
                'onboarding-daily-about-fillers',
                counters.newAboutFillers,
                buildDailyRecordAlert('New about fillers')
            );
            await alertIfRecord(
                parent,
                chatId,
                'onboarding-daily-like-givers',
                counters.newThreeLikeGivers,
                buildDailyRecordAlert('New three like givers')
            );
            await alertIfRecord(
                parent,
                chatId,
                'onboarding-daily-like-getters',
                counters.newThreeLikeGetters,
                buildDailyRecordAlert('New three like getters')
            );
        });
    }
    return queue;
}