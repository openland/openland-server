import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { Modules } from '../../openland-modules/Modules';
import { inTx } from '@openland/foundationdb';
import { ScheduledQueue } from '../../openland-module-workers/ScheduledQueue';
import { getOnboardingCounters, getOnboardingReportsChatId, getSuperNotificationsBotId } from './utils';
import { buildMessage, heading } from '../../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';

const log = createLogger('daily-onboarding-report');

export function createDailyOnboardingReportWorker() {
    let queue = new ScheduledQueue('daily-onboarding', {
        interval: 'every-day', time: { hours: 10, minutes: 0 },
    });
    if (serverRoleEnabled('workers')) {
        queue.addWorker(async (parent) => {
            return await inTx(parent, async ctx => {
                const chatId = await getOnboardingReportsChatId(ctx);
                const botId = await getSuperNotificationsBotId(ctx);
                if (!chatId || !botId) {
                    log.warn(ctx, 'botId or chatId not specified');
                    return { result: 'rejected' };
                }

                let counters = await getOnboardingCounters(Date.now() - 24 * 60 * 60 * 1000);

                const report = [heading([
                    `Daily`,
                    `🐥 ${counters.newUserEntrances}`,
                    `📱 ${counters.newMobileUsers}`,
                    `➡️ ${counters.newSenders}`,
                    `🙌 ${counters.newInviters}`,
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