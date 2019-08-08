import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { Modules } from '../../openland-modules/Modules';
import { ScheduledQueue, WeekDay } from '../../openland-module-workers/ScheduledQueue';
import { buildMessage, heading } from '../../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';
import { getOnboardingCounters, getOnboardingReportsChatId, getSuperNotificationsBotId } from './utils';
import { inTx } from '@openland/foundationdb';

const log = createLogger('weekly-onboarding-report');

export function createWeeklyOnboardingReportWorker() {
    let queue = new ScheduledQueue('weekly-onboarding', {
        interval: 'every-week',
        time: { weekDay: WeekDay.Monday, hours: 10, minutes: 0 },
    });
    if (serverRoleEnabled('workers')) {
        queue.addWorker((parent) => {
            return inTx(parent, async ctx => {
                const chatId = await getOnboardingReportsChatId(ctx);
                const botId = await getSuperNotificationsBotId(ctx);
                if (!chatId || !botId) {
                    log.warn(ctx, 'botId or chatId not specified');
                    return { result: 'rejected' };
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

                await Modules.Messaging.sendMessage(ctx, chatId!, botId!, {
                    ...buildMessage(...report), ignoreAugmentation: true,
                });
                return { result: 'completed' };
            });
        });
    }
    return queue;
}