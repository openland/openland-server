import { DelayedQueue } from '../../openland-module-workers/DelayedQueue';
import { Modules } from '../../openland-modules/Modules';
import { inTx } from '@openland/foundationdb';
import { FDB, Store } from '../../openland-module-db/FDB';
import { buildMessage, heading, userMention } from '../../openland-utils/MessageBuilder';
import { plural } from '../../openland-utils/string';
import { Context } from '@openland/context';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { createLogger } from '@openland/log';

const getSuperNotificationsBotId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'super-notifications-app-id');
const getSuperReportsChatId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'super-reports-chat-id');
const log = createLogger('first-week-report-worker');

const calculateScore = (usedMobile: boolean, groupJoins: number, messages: number, invites: number) => {
    let score = 0;
    if (usedMobile) {
        score += 5;
    }
    score += groupJoins;
    score += messages;
    score += invites * 5;

    return score;
};

export function createFirstWeekReportWorker() {
    const q = new DelayedQueue<{ uid: number }, { result: string }>('first-week-user-report');
    if (serverRoleEnabled('workers')) {
        q.start((item, rootCtx) => {
            return inTx(rootCtx, async (ctx) => {
                const botId = await getSuperNotificationsBotId(ctx);
                const chatId = await getSuperReportsChatId(ctx);

                if (!botId || !chatId) {
                    log.warn(ctx, 'botId or chatId not specified');
                    return { result: 'completed' };
                }

                const { uid } = item;

                const profile = await Modules.Users.profileById(ctx, uid);
                const onlines = await FDB.Presence.allFromUser(ctx, uid);
                const mobileOnline = !!onlines
                    .find((e) => e.platform.startsWith('ios') || e.platform.startsWith('android'));
                const groupsJoined = await Store.UserMessagesChatsCounter.byId(uid).get(ctx) - await Store.UserMessagesDirectChatsCounter.byId(uid).get(ctx);
                const directMessages = await Store.UserMessagesSentInDirectChatTotalCounter.byId(uid).get(ctx);
                const allMessages = await Store.UserMessagesSentCounter.byId(uid).get(ctx);
                const groupMessages = allMessages - directMessages;
                const successfulInvites = await Store.UserSuccessfulInvitesCounter.byId(uid).get(ctx);
                const score = calculateScore(mobileOnline, groupsJoined, allMessages, successfulInvites);

                let orgName = '';
                if (profile!.primaryOrganization) {
                    const organization = await FDB.OrganizationProfile.findById(ctx, profile!.primaryOrganization);
                    orgName = ` @ ${(organization!).name}`;
                }

                let report = [
                    heading(
                        'First week report ',
                        userMention(profile!.firstName + ' ' + profile!.lastName, uid),
                        orgName,
                        ` ⚡️ ${score}`,
                    ),
                    '\n',
                ];

                if (mobileOnline) {
                    report.push('📱 Mobile app is used');
                } else {
                    report.push('🚫 Mobile app is not used');
                }
                report.push('\n');
                report.push(`👨‍👦‍👦 ${groupsJoined} ${plural(groupsJoined, ['group', 'groups'])} joined\n`);
                report.push(`😎 ${allMessages} ${plural(directMessages, ['message', 'messages'])} sent, ${directMessages} DMs, ${groupMessages} in groups\n`);
                report.push(`🤗 ${successfulInvites} successful ${plural(successfulInvites, ['invite', 'invites'])}\n`);

                await Modules.Messaging.sendMessage(ctx, chatId!, botId!, {
                    ...buildMessage(...report),
                    ignoreAugmentation: true,
                });

                return { result: 'completed' };
            });
        });
    }
    return q;
}