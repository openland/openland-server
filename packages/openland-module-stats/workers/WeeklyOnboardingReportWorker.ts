import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { Modules } from '../../openland-modules/Modules';
import { ScheduledQueue, WeekDay } from '../../openland-module-workers/ScheduledQueue';
import { buildMessage, heading } from '../../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';
import { getOnboardingReportsChatId, getSuperNotificationsBotId, getGlobalStatisticsForReport } from './utils';

const log = createLogger('weekly-onboarding-report');

export function createWeeklyOnboardingReportWorker() {
    let queue = new ScheduledQueue('weekly-onboarding', {
        interval: 'every-week',
        time: { weekDay: WeekDay.Monday, hours: 10, minutes: 0 },
    });
    if (serverRoleEnabled('workers')) {
        queue.addWorker(async (ctx) => {
            const chatId = await getOnboardingReportsChatId(ctx);
            const botId = await getSuperNotificationsBotId(ctx);
            if (!chatId || !botId) {
                log.warn(ctx, 'botId or chatId not specified');
                return { result: 'rejected' };
            }

            const currentStats = getGlobalStatisticsForReport();
            const prevWeekStats = getGlobalStatisticsForReport('prev-week');

            const userEntrances = await currentStats.userEntrances.get(ctx);
            const yesterdayUserEntrances = await prevWeekStats.userEntrances.get(ctx);
            const newUserEntrances = userEntrances - yesterdayUserEntrances;
            prevWeekStats.userEntrances.set(ctx, userEntrances);

            const mobileUsers = await currentStats.mobileUsers.get(ctx);
            const yesterdayMobileUsers = await prevWeekStats.mobileUsers.get(ctx);
            const newMobileUsers = mobileUsers - yesterdayMobileUsers;
            prevWeekStats.mobileUsers.set(ctx, mobileUsers);

            const senders =  await currentStats.senders.get(ctx);
            const yesterdaySenders = await prevWeekStats.senders.get(ctx);
            const newSenders = senders - yesterdaySenders;
            prevWeekStats.senders.set(ctx, senders);

            const inviters = await currentStats.inviters.get(ctx);
            const yesterdayInviters = await prevWeekStats.inviters.get(ctx);
            const newInviters = inviters - yesterdayInviters;
            prevWeekStats.inviters.set(ctx, inviters);

            const report = [heading(`Weekly   🐥 ${newUserEntrances}   📱 ${newMobileUsers}    ➡️ ${newSenders}    🙌 ${newInviters}`)];

            await Modules.Messaging.sendMessage(ctx, chatId!, botId!, {
                ...buildMessage(...report), ignoreAugmentation: true,
            });
            return { result: 'completed' };
        });
    }
    return queue;
}