import { timedWorker, WeekDay } from '../../openland-module-workers/timedWorker';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import {
    getGlobalStatisticsForReport,
    getSuperNotificationsBotId,
    getWeeklyReportsChatId,
} from './utils';
import { buildMessage, heading } from '../../openland-utils/MessageBuilder';
import { formatNumberWithSign, plural } from '../../openland-utils/string';
import { Modules } from '../../openland-modules/Modules';
import { createLogger } from '@openland/log';

const log = createLogger('weekly-report-worker');
export function createWeeklyReportWorker() {
    if (serverRoleEnabled('workers')) {
        timedWorker('weekly-summary', {
            interval: 'every-week',
            time: { weekDay: WeekDay.Monday, hours: 10, minutes: 0 }
        }, async (ctx) => {
            const chatId = await getWeeklyReportsChatId(ctx);
            const botId = await getSuperNotificationsBotId(ctx);
            if (!chatId || !botId) {
                log.warn(ctx, 'botId or chatId not specified');
                return { result: 'completed' };
            }

            const allTimeStats = getGlobalStatisticsForReport();
            const prevWeekStats = getGlobalStatisticsForReport('prev-week');
            const prevWeekStatsSnapshot = getGlobalStatisticsForReport('prev-week-snapshot');

            const userEntrances = await allTimeStats.userEntrances.get(ctx);
            const prevWeekUserEntrances = await prevWeekStats.userEntrances.get(ctx);
            const newUserEntrances = userEntrances - prevWeekUserEntrances;
            const newUserEntrancesDiff = newUserEntrances - (await prevWeekStats.userEntrances.get(ctx));
            prevWeekStats.userEntrances.set(ctx, userEntrances);
            prevWeekStatsSnapshot.userEntrances.set(ctx, newUserEntrances);

            const mobileUsers = await allTimeStats.mobileUsers.get(ctx);
            const prevWeekMobileUsers = await prevWeekStats.mobileUsers.get(ctx);
            const newMobileUsers = mobileUsers - prevWeekMobileUsers;
            const newMobileUsersDiff = newMobileUsers - (await prevWeekStats.mobileUsers.get(ctx));
            prevWeekStats.mobileUsers.set(ctx, mobileUsers);
            prevWeekStatsSnapshot.mobileUsers.set(ctx, newMobileUsers);

            const successfulInvites = await allTimeStats.successfulInvites.get(ctx);
            const prevWeekSuccessfulInvites = await prevWeekStats.successfulInvites.get(ctx);
            const newInvites = successfulInvites - prevWeekSuccessfulInvites;
            const newInvitesDiff = newInvites - (await prevWeekStats.successfulInvites.get(ctx));
            prevWeekStats.successfulInvites.set(ctx, successfulInvites);
            prevWeekStatsSnapshot.successfulInvites.set(ctx, newInvites);

            const report = [heading('Weekly'), '\n'];
            report.push(`🐥 ${newUserEntrances} (${formatNumberWithSign(newUserEntrancesDiff)}) new user ${plural(newUserEntrances, ['entrance', 'entrances'])}\n`);
            report.push(`📱 ${newMobileUsers} (${formatNumberWithSign(newMobileUsersDiff)}) new mobile ${plural(newMobileUsers, ['user', 'users'])}\n`);
            report.push(`🙌🏽 ${newInvites} (${formatNumberWithSign(newInvitesDiff)}) successful ${plural(newInvites, ['invite', 'invites'])}\n`);

            await Modules.Messaging.sendMessage(ctx, chatId!, botId!, {
                ...buildMessage(...report),
                ignoreAugmentation: true,
            });

            return { result: 'completed' };
        });
    }
}