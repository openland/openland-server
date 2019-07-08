import { injectable } from 'inversify';
import { createFirstWeekReportWorker } from './workers/FirstWeekReportWorker';
import { createSilentUserReportWorker } from './workers/SilentUserReportWorker';
import { Context } from '@openland/context';
import { createWeeklyReportWorker } from './workers/WeeklyReportWorker';
import { createDailyReportWorker } from './workers/DailyReportWorker';
import { Store } from '../openland-module-db/FDB';
import { Modules } from '../openland-modules/Modules';
import { boldString, buildMessage, heading, userMention } from '../openland-utils/MessageBuilder';
import { getSuperNotificationsBotId, getUserReportsChatId, resolveUsername } from './workers/utils';
import { createLogger } from '@openland/log';
import { inTx } from '@openland/foundationdb';
import { plural } from '../openland-utils/string';

const log = createLogger('stats');

@injectable()
export class StatsModule {
    private readonly firstWeekReportQueue = createFirstWeekReportWorker();
    private readonly silentUserReportQueue = createSilentUserReportWorker();

    start = () => {
        createDailyReportWorker();
        createWeeklyReportWorker();
    }

    queueFirstWeekReport = (ctx: Context, uid: number, dbgDelay?: number) => {
        let delay = dbgDelay ? dbgDelay : 1000 * 60 * 60 * 24 * 7; // 7 days

        return this.firstWeekReportQueue.pushWork(ctx, { uid }, Date.now() + delay);
    }

    queueSilentUserReport = (ctx: Context, uid: number, dbgDelay?: number) => {
        let delay = dbgDelay ? dbgDelay :  1000 * 60 * 60 * 24 * 2; // 2 days

        return this.silentUserReportQueue.pushWork(ctx, { uid }, Date.now() + delay);
    }

    onNewMobileUser = (ctx: Context) => {
        Store.GlobalStatisticsCounters.byId('mobile-users').increment(ctx);
    }

    onNewEntrance = (ctx: Context) => {
        Store.GlobalStatisticsCounters.byId('user-entrances').increment(ctx);
    }

    onEmailSent = (ctx: Context, uid: number) => {
        Store.UserEmailSentCounter.byId(uid).increment(ctx);
    }

    onSuccessfulInvite = async (ctx: Context, newUserId: number, inviterId: number) => {
        Store.GlobalStatisticsCounters.byId('successful-invites').increment(ctx);

        let invitesCnt = await Store.UserSuccessfulInvitesCounter.byId(inviterId).get(ctx);
        if (invitesCnt === 1) {
            await this.generateNewInviterReport(ctx, newUserId, inviterId);
        }
    }

    generateNewInviterReport = async (ctx: Context, newUserId: number, inviterId: number) => {
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
            const organization = await Store.OrganizationProfile.findById(ctx, inviter!.primaryOrganization);
            inviterOrgName = ` @ ${(organization!).name}`;
        }

        let newUserOrgName = '';
        if (newUser!.primaryOrganization) {
            const organization = await Store.OrganizationProfile.findById(ctx, newUser!.primaryOrganization);
            newUserOrgName = ` @ ${(organization!).name}`;
        }

        let report = [heading('New inviter ', userMention(resolveUsername(inviter!.firstName, inviter!.lastName), inviterId), inviterOrgName), '\n'];

        report.push('Invited ');
        report.push(userMention(resolveUsername(newUser!.firstName, newUser!.lastName), newUserId));
        report.push(newUserOrgName);

        await Modules.Messaging.sendMessage(ctx, chatId!, botId!, {
            ...buildMessage(...report), ignoreAugmentation: true,
        });
    }

    generateSilentUserReport = (rootCtx: Context, uid: number) => {
        return inTx(rootCtx, async (ctx) => {
            const botId = await getSuperNotificationsBotId(ctx);
            const chatId = await getUserReportsChatId(ctx);

            if (!botId || !chatId) {
                log.warn(ctx, 'botId or chatId not specified');
                return;
            }

            const messagesSent = await Store.UserMessagesSentCounter.byId(uid).get(ctx);
            if (messagesSent > 0) {
                return;
            }

            const profile = await Modules.Users.profileById(ctx, uid);
            let orgName = '';
            if (profile!.primaryOrganization) {
                const organization = await Store.OrganizationProfile.findById(ctx, profile!.primaryOrganization);
                orgName = ` @ ${(organization!).name}`;
            }

            let report = [heading('Silent user ', userMention(resolveUsername(profile!.firstName, profile!.lastName), uid), orgName), '\n'];

            const onlines = await Store.Presence.user.findAll(ctx, uid);
            const mobileOnline = onlines
                .find((e) => e.platform.startsWith('ios') || e.platform.startsWith('android'));
            if (mobileOnline) {
                report.push('✅ Mobile ');
            } else {
                report.push('🚫 Mobile ');
            }

            const isDiscoverDone = await Modules.Discover.isDiscoverDone(ctx, uid);
            if (isDiscoverDone) {
                report.push('✅ Chats for you ');
            } else {
                report.push('🚫 Chats for you ');
            }

            const groupsJoined = await Store.UserMessagesChatsCounter.byId(uid).get(ctx) - await Store.UserMessagesDirectChatsCounter.byId(uid).get(ctx);
            report.push(`👥 ${groupsJoined} ${plural(groupsJoined, ['group', 'groups'])}`);

            await Modules.Messaging.sendMessage(ctx, chatId!, botId!, {
                ...buildMessage(...report), ignoreAugmentation: true,
            });

            return { result: 'completed' };
        });
    }

    calculateUserScore = (usedMobile: boolean, groupJoins: number, messages: number, invites: number) => {
        let score = 0;
        if (usedMobile) {
            score += 5;
        }
        score += groupJoins;
        score += messages;
        score += invites * 5;

        return score;
    }

    generateFirstWeekUserReport = async (rootCtx: Context, uid: number) => {
        await inTx(rootCtx, async (ctx) => {
            const botId = await getSuperNotificationsBotId(ctx);
            const chatId = await getUserReportsChatId(ctx);

            if (!botId || !chatId) {
                log.warn(ctx, 'botId or chatId not specified');
                return { result: 'completed' };
            }

            const profile = await Modules.Users.profileById(ctx, uid);
            if (profile!.email && profile!.email.endsWith('maildu.de')) {
                return { result: 'completed' };
            }

            const onlines = await Store.Presence.user.findAll(ctx, uid);
            const mobileOnline = !!onlines
                .find((e) => e.platform.startsWith('ios') || e.platform.startsWith('android'));
            const groupsJoined = await Store.UserMessagesChatsCounter.byId(uid).get(ctx) - await Store.UserMessagesDirectChatsCounter.byId(uid).get(ctx);
            const directMessages = await Store.UserMessagesSentInDirectChatTotalCounter.byId(uid).get(ctx);
            const allMessages = await Store.UserMessagesSentCounter.byId(uid).get(ctx);
            const groupMessages = allMessages - directMessages;
            const successfulInvites = await Store.UserSuccessfulInvitesCounter.byId(uid).get(ctx);
            const score = this.calculateUserScore(mobileOnline, groupsJoined, allMessages, successfulInvites);

            const emailSent = await Store.UserEmailSentCounter.byId(uid).get(ctx);
            const browserPushSent = await Store.UserBrowserPushSentCounter.byId(uid).get(ctx);
            const mobilePushSent = await Store.UserMobilePushSentCounter.byId(uid).get(ctx);

            const userSettings = await Modules.Users.getUserSettings(ctx, uid);

            let orgName = '';
            if (profile!.primaryOrganization) {
                const organization = await Store.OrganizationProfile.findById(ctx, profile!.primaryOrganization);
                orgName = ` @ ${(organization!).name}`;
            }

            let report = [heading('First week report ', userMention(resolveUsername(profile!.firstName, profile!.lastName), uid), orgName, ` ⚡️ ${score}`), '\n'];
            if (score > 0) {
                report.push(`👥 `);
                report.push(boldString(`${groupsJoined} `));
                report.push(`${plural(groupsJoined, ['group', 'groups'])}  `);
                report.push(`➡️ `);
                report.push(boldString(`${allMessages}·${directMessages}·${groupMessages} `));
                report.push(`${plural(directMessages, ['message', 'messages'])} sent: all, dm, gm  `);
                if (mobileOnline) {
                    report.push('● mobile  ');
                } else {
                    report.push('○ mobile  ');
                }
                report.push(`👋 `);
                report.push(boldString(`${successfulInvites}`));
                report.push(` ${plural(successfulInvites, ['user', 'users'])} invited\n`);

                report.push('🚨 ');
                report.push(boldString(`${browserPushSent}·${emailSent}·${mobilePushSent} `));
                report.push(`pushes: broswer, email, mobile  `);

                // privileges
                switch (userSettings.desktopNotifications) {
                    case 'none':
                        report.push('○');
                        break;
                    default:
                        report.push('●');
                }
                switch (userSettings.emailFrequency) {
                    case 'never':
                        report.push('○');
                        break;
                    default:
                        report.push('●');
                        break;
                }
                switch (userSettings.mobileNotifications) {
                    case 'none':
                        report.push('○');
                        break;
                    default:
                        report.push('●');
                }
                report.push(' privileges: browser, email, mobile');
            }

            await Modules.Messaging.sendMessage(ctx, chatId!, botId!, {
                ...buildMessage(...report), ignoreAugmentation: true,
            });

            return { result: 'completed' };
        });
    }
}