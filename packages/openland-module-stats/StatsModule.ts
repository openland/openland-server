import { injectable } from 'inversify';
import { createFirstWeekReportWorker } from './workers/FirstWeekReportWorker';
import { createSilentUserReportWorker } from './workers/SilentUserReportWorker';
import { Context } from '@openland/context';
import { createWeeklyReportWorker } from './workers/WeeklyReportWorker';
import { createDailyReportWorker } from './workers/DailyReportWorker';
import { FDB, Store } from '../openland-module-db/FDB';
import { Modules } from '../openland-modules/Modules';
import { buildMessage, heading, userMention } from '../openland-utils/MessageBuilder';
import { getSuperNotificationsBotId, getUserReportsChatId } from './workers/utils';
import { createLogger } from '@openland/log';

const log = createLogger('stats');

@injectable()
export class StatsModule {
    private readonly firstWeekReportQueue = createFirstWeekReportWorker();
    private readonly silentUserReportQueue = createSilentUserReportWorker();

    start = () => {
        createDailyReportWorker();
        createWeeklyReportWorker();
    }

    queueFirstWeekReport = (ctx: Context, uid: number) => {
        return this.firstWeekReportQueue.pushWork(ctx, { uid }, Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
    }

    queueSilentUserReport = (ctx: Context, uid: number) => {
        return this.silentUserReportQueue.pushWork(ctx, { uid }, Date.now() + 1000 * 60 * 60 * 24 * 2); // 2 days
    }

    onNewMobileUser = (ctx: Context) => {
        Store.GlobalStatisticsCounters.byId('mobile-users').increment(ctx);
    }

    onNewEntrance = (ctx: Context) => {
        Store.GlobalStatisticsCounters.byId('user-entrances').increment(ctx);
    }

    onSuccessfulInvite = async (ctx: Context, newUserId: number, inviterId: number) => {
        Store.GlobalStatisticsCounters.byId('successful-invites').increment(ctx);

        let invitesCnt = await Store.UserSuccessfulInvitesCounter.byId(inviterId).get(ctx);
        if (invitesCnt === 1) {
            await this.generateFirstInviterReport(ctx, newUserId, inviterId);
        }
    }

    generateFirstInviterReport = async (ctx: Context, newUserId: number, inviterId: number) => {
        const botId = await getSuperNotificationsBotId(ctx);
        const chatId = await getUserReportsChatId(ctx);

        if (!botId || !chatId) {
            log.warn(ctx, 'botId or chatId not specified');
            return;
        }

        const inviter = await Modules.Users.profileById(ctx, inviterId);
        const newUser = await Modules.Users.profileById(ctx, newUserId);

        let inviterOrgName = '';
        if (inviter!.primaryOrganization) {
            const organization = await FDB.OrganizationProfile.findById(ctx, inviter!.primaryOrganization);
            inviterOrgName = ` @ ${(organization!).name}`;
        }

        let newUserOrgName = '';
        if (newUser!.primaryOrganization) {
            const organization = await FDB.OrganizationProfile.findById(ctx, newUser!.primaryOrganization);
            newUserOrgName = ` @ ${(organization!).name}`;
        }

        let report = [
            heading(
                'First inviter ',
                userMention(inviter!.firstName + ' ' + inviter!.lastName, inviterId),
                inviterOrgName,
            ),
            '\n',
        ];

        report.push('Invited ');
        report.push(userMention(newUser!.firstName + ' ' + newUser!.lastName, newUserId));
        report.push(newUserOrgName);

        await Modules.Messaging.sendMessage(ctx, chatId!, botId!, {
            ...buildMessage(...report),
            ignoreAugmentation: true,
        });
    }
}