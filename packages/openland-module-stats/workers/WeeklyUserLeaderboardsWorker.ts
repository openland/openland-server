import { Modules } from '../../openland-modules/Modules';
import { ScheduledQueue, WeekDay } from '../../openland-module-workers/ScheduledQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { getLeaderboardsChatId, getSuperNotificationsBotId } from './utils';
import { Store } from '../../openland-module-db/FDB';
import { buildMessage, heading, userMention } from '../../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';
import { inTx } from '@openland/foundationdb';
import { UserProfile } from '../../openland-module-db/store';

const log = createLogger('weekly-user-leaderboards');

export function createWeeklyUserLeaderboardsWorker() {
    let queue = new ScheduledQueue('weekly-user-leaderboards',  {
        interval: 'every-week',
        time: { weekDay: WeekDay.Monday, hours: 10, minutes: 0 },
    });
    if (serverRoleEnabled('workers')) {
        queue.addWorker(async (parent) => {
            const chatId = await getLeaderboardsChatId(parent);
            const botId = await getSuperNotificationsBotId(parent);
            if (!chatId || !botId) {
                log.warn(parent, 'botId or chatId not specified');
                return { result: 'rejected' };
            }

            let allUsers = await inTx(parent, async ctx => await Store.UserProfile.findAll(ctx));

            let usersWithInvites: { invites: number, user: UserProfile }[] = [];
            for (let user of allUsers) {
                await inTx(parent, async ctx => {
                    let successfulInvites = await Store.UserSuccessfulInvitesCounter.byId(user.id).get(ctx);
                    let prevWeekInvites = await Store.UserSuccessfulInvitesPrevWeekCounter.byId(user.id).get(ctx);
                    let newInvites = successfulInvites - prevWeekInvites;
                    Store.UserSuccessfulInvitesPrevWeekCounter.byId(user.id).set(ctx, successfulInvites);
                    if (newInvites === 0) {
                        return;
                    }

                    usersWithInvites.push({
                        invites: newInvites,
                        user,
                    });
                });
            }

            let users = usersWithInvites
                .sort((a, b) => b.invites - a.invites)
                .slice(0, 20);

            let message = [heading('Top 20 users by invites this week'), '\n'];
            for (let i = 0; i < users.length; i++) {
                let { user, invites } = users[i];
                message.push(`${i + 1}. `, userMention([user.firstName, user.lastName].join(' '), user.id), `  -  ${invites} invites\n`);
            }

            await Modules.Messaging.sendMessage(parent, chatId!, botId!, {
                ...buildMessage(...message), ignoreAugmentation: true,
            });
            return { result: 'completed' };
        });
    }
    return queue;
}