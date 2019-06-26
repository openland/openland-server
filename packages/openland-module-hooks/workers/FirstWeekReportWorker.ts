import { DelayedQueue } from '../../openland-module-workers/DelayedQueue';
import { Modules } from '../../openland-modules/Modules';
import { inTx } from '@openland/foundationdb';
import { FDB, Store } from '../../openland-module-db/FDB';
import { boldString, buildMessage, userMention } from '../../openland-utils/MessageBuilder';
import { plural } from '../../openland-utils/string';
import { Context } from '@openland/context';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { createLogger } from '@openland/log';

const getSuperNotificationsBotId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'super-notifications-app-id');
const getSuperReportsChatId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'super-reports-chat-id');
const log = createLogger('first-week-report-worker');

export function createFirstWeekReportWorker() {
    const q = new DelayedQueue<{ uid: number }, { result: string }>('first-week-user-report');
    if (serverRoleEnabled('workers')) {
        q.start( (item, rootCtx) => {
            return inTx(rootCtx, async (ctx) => {
                const botId = await getSuperNotificationsBotId(ctx);
                const chatId = await getSuperReportsChatId(ctx);

                if (!botId || !chatId) {
                    log.warn(ctx, 'botId or chatId not specified');
                    return { result: 'completed' };
                }

                const { uid } = item;

                const profile = await Modules.Users.profileById(ctx, uid);
                let report = [
                    boldString('First week report'), '\n',
                    userMention(profile!.firstName + ' ' + profile!.lastName, uid)
                ];
                if (profile!.primaryOrganization) {
                    const organization = await FDB.OrganizationProfile.findById(ctx, profile!.primaryOrganization);
                    report.push(` @ ${(organization!).name}`);
                }
                report.push('\n');

                const onlines = await FDB.Presence.allFromUser(ctx, uid);
                const mobileOnline = onlines
                    .find((e) => e.platform.startsWith('ios') || e.platform.startsWith('android'));
                if (mobileOnline) {
                    report.push('📱 Mobile app used');
                } else {
                    report.push('📱 Mobile app not used');
                }
                report.push('\n');

                const groupsJoined = await Store.UserMessagesChatsCounter.byId(uid).get(ctx) - await Store.UserMessagesDirectChatsCounter.byId(uid).get(ctx);
                report.push(`👨‍👦‍👦 ${groupsJoined} ${plural(groupsJoined, ['group', 'groups'])} joined\n`);

                const successfulInvites = await Store.UserSuccessfulInvitesCounter.byId(uid).get(ctx);
                report.push(`🤗 ${successfulInvites} successful ${plural(successfulInvites, ['invite', 'invites'])}\n`);

                const directMessages = await Store.UserMessagesSentInDirectChatTotalCounter.byId(uid).get(ctx);
                const allMessages = await Store.UserMessagesSentCounter.byId(uid).get(ctx);
                const groupMessages = allMessages - directMessages;
                report.push(`✉️ ${directMessages} direct ${plural(directMessages, ['message', 'messages'])} sent\n`);
                report.push(`✉️ ${groupMessages} group ${plural(groupMessages, ['message', 'messages'])} sent`);

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