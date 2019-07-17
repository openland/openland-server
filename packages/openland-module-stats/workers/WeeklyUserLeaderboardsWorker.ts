import { Modules } from '../../openland-modules/Modules';
import { ScheduledQueue, WeekDay } from '../../openland-module-workers/ScheduledQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { getLeaderboardsChatId, getSuperNotificationsBotId } from './utils';
import { Store } from '../../openland-module-db/FDB';
import { buildMessage, heading, userMention } from '../../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';

const log = createLogger('weekly-user-leaderboards');

export function createWeeklyUserLeaderboardsWorker() {
    let queue = new ScheduledQueue('weekly-leaderboards',  {
        interval: 'every-week',
        time: { weekDay: WeekDay.Monday, hours: 10, minutes: 0 },
    });
    if (serverRoleEnabled('workers')) {
        queue.addWorker(async (ctx) => {
            const chatId = await getLeaderboardsChatId(ctx);
            const botId = await getSuperNotificationsBotId(ctx);
            if (!chatId || !botId) {
                log.warn(ctx, 'botId or chatId not specified');
                return { result: 'rejected' };
            }

            let usersQuery = await Store.UserProfile.created.query(ctx, {
                after: Date.now() - 1000 * 60 * 60 * 24 * 14,
                limit: 1000,
            });
            let items = usersQuery.items;
            while (usersQuery.haveMore) {
                usersQuery = await Store.UserProfile.created.query(ctx, {
                    afterCursor: usersQuery.cursor,
                    limit: 1000,
                });
                items = items.concat(usersQuery.items);
            }

            let invites = new Map<number, number>();
            for (let user of items) {
                const invitesByUser = await Store.UserSuccessfulInvitesCounter.byId(user.id).get(ctx);
                invites.set(user.id, invitesByUser);
            }

            let users = items
                .sort((a, b) => invites.get(b.id)! - invites.get(a.id)!)
                .slice(0, 10);

            let message = [heading('New users by invites'), '\n'];
            for (let i = 0; i < users.length; i++) {
                let user = users[i];
                message.push(`${i + 1}. `, userMention([user.firstName, user.lastName].join(' '), user.id), `   ⚡️${invites.get(user.id)}\n`);
            }

            await Modules.Messaging.sendMessage(ctx, chatId!, botId!, {
                ...buildMessage(...message), ignoreAugmentation: true,
            });
            return { result: 'completed' };
        });
    }
    return queue;
}