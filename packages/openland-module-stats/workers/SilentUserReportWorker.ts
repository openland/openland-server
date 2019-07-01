import { DelayedQueue } from '../../openland-module-workers/DelayedQueue';
import { inTx } from '@openland/foundationdb';
import { Modules } from '../../openland-modules/Modules';
import { buildMessage, heading, userMention } from '../../openland-utils/MessageBuilder';
import { FDB, Store } from '../../openland-module-db/FDB';
import { plural } from '../../openland-utils/string';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { createLogger } from '@openland/log';
import { getSuperNotificationsBotId, getUserReportsChatId } from './utils';

const log = createLogger('silent-user-report-worker');

export function createSilentUserReportWorker() {
    const q = new DelayedQueue<{ uid: number }, { result: string }>('silent-user-report');
    if (serverRoleEnabled('workers')) {
        q.start( (item, rootCtx) => {
            return inTx(rootCtx, async (ctx) => {
                const botId = await getSuperNotificationsBotId(ctx);
                const chatId = await getUserReportsChatId(ctx);

                if (!botId || !chatId) {
                    log.warn(ctx, 'botId or chatId not specified');
                    return { result: 'completed' };
                }
                const { uid } = item;

                const messagesSent = await Store.UserMessagesSentCounter.byId(uid).get(ctx);
                if (messagesSent > 0) {
                    return { result: 'completed' };
                }

                const profile = await Modules.Users.profileById(ctx, uid);
                let orgName = '';
                if (profile!.primaryOrganization) {
                    const organization = await FDB.OrganizationProfile.findById(ctx, profile!.primaryOrganization);
                    orgName = ` @ ${(organization!).name}`;
                }

                let report = [
                    heading(
                        'Silent user ',
                        userMention(profile!.firstName + ' ' + profile!.lastName, uid),
                        orgName,
                    ),
                    '\n',
                ];

                const onlines = await FDB.Presence.allFromUser(ctx, uid);
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
                report.push(`👥 ${groupsJoined} ${plural(groupsJoined, ['group', 'groups'])}\n`);

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