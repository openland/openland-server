import { timedWorker } from '../../openland-module-workers/timedWorker';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { Modules } from '../../openland-modules/Modules';
import { buildMessage, heading } from '../../openland-utils/MessageBuilder';
import { plural } from '../../openland-utils/string';
import { getGrowthReportsChatId, getSuperNotificationsBotId, getGlobalStatisticsForReport } from './utils';
import { createLogger } from '@openland/log';

const log = createLogger('daily-report-worker');
export function createDailyReportWorker() {
    if (serverRoleEnabled('workers')) {
        timedWorker('daily-summary', {
            interval: 'every-day',
            time: { hours: 14, minutes: 0 },
        }, async (ctx) => {
            const chatId = await getGrowthReportsChatId(ctx);
            const botId = await getSuperNotificationsBotId(ctx);
            if (!chatId || !botId) {
                log.warn(ctx, 'botId or chatId not specified');
                return { result: 'completed' };
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

            const successfulInvites = await currentStats.successfulInvites.get(ctx);
            const yesterdaySuccessfulInvites = await yesterdayStats.successfulInvites.get(ctx);
            const newInvites = successfulInvites - yesterdaySuccessfulInvites;
            yesterdayStats.successfulInvites.set(ctx, successfulInvites);

            const report = [heading('Daily'), '\n'];
            report.push(`🐥 ${newUserEntrances} new user ${plural(newUserEntrances, ['entrance', 'entrances'])}\n`);
            report.push(`📱 ${newMobileUsers} new mobile ${plural(newMobileUsers, ['user', 'users'])}\n`);
            report.push(`🙌🏽 ${newInvites} successful ${plural(newInvites, ['invite', 'invites'])}\n`);

            await Modules.Messaging.sendMessage(ctx, chatId!, botId!, {
                ...buildMessage(...report),
                ignoreAugmentation: true,
            });

            return { result: 'completed' };
        });
    }
}