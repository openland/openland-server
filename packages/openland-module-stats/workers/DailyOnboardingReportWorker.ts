import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { Modules } from '../../openland-modules/Modules';
import { inTx } from '@openland/foundationdb';
import { ScheduledQueue } from '../../openland-module-workers/ScheduledQueue';
import { getGlobalStatisticsForReport, getOnboardingReportsChatId, getSuperNotificationsBotId } from './utils';
import { buildMessage, heading } from '../../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';

const log = createLogger('daily-onboarding-report');

export function createDailyOnboardingReportWorker() {
    let queue = new ScheduledQueue('daily-onboarding', {
        interval: 'every-day',
        time: { hours: 10, minutes: 0 },
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

                const currentStats = getGlobalStatisticsForReport();
                const yesterdayStats = getGlobalStatisticsForReport('yesterday');

                const userEntrances = await currentStats.userEntrances.get(ctx);
                const yesterdayUserEntrances = await yesterdayStats.userEntrances.get(ctx);
                const newUserEntrances = userEntrances - yesterdayUserEntrances;
                yesterdayStats.userEntrances.set(ctx, userEntrances);

                const mobileUsers = await currentStats.mobileUsers.get(ctx);
                const yesterdayMobileUsers = await yesterdayStats.mobileUsers.get(ctx);
                const newMobileUsers = mobileUsers - yesterdayMobileUsers;
                yesterdayStats.mobileUsers.set(ctx, mobileUsers);

                const senders =  await currentStats.senders.get(ctx);
                const yesterdaySenders = await yesterdayStats.senders.get(ctx);
                const newSenders = senders - yesterdaySenders;
                yesterdayStats.senders.set(ctx, senders);

                const inviters = await currentStats.inviters.get(ctx);
                const yesterdayInviters = await yesterdayStats.inviters.get(ctx);
                const newInviters = inviters - yesterdayInviters;
                yesterdayStats.inviters.set(ctx, inviters);

                const report = [heading(`Daily   🐥 ${newUserEntrances}   📱 ${newMobileUsers}    ➡️ ${newSenders}    🙌 ${newInviters}`)];

                await Modules.Messaging.sendMessage(ctx, chatId!, botId!, {
                    ...buildMessage(...report), ignoreAugmentation: true,
                });
                return { result: 'completed' };
            });

        });
    }
    return queue;
}