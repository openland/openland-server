import { Modules } from '../../openland-modules/Modules';
import { ScheduledQueue, WeekDay } from '../../openland-module-workers/ScheduledQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { getLeaderboardsChatId, getSuperNotificationsBotId } from './utils';
import { Store } from '../../openland-module-db/FDB';
import { buildMessage, heading } from '../../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';

const log = createLogger('weekly-room-leaderboards');

export function createWeeklyRoomLeaderboardsWorker() {
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

            let roomsQuery = await Store.RoomProfile.created.query(ctx, {
                after: Date.now() - 1000 * 60 * 60 * 24 * 14,
                limit: 1000,
            });
            let items = roomsQuery.items;
            while (roomsQuery.haveMore) {
                roomsQuery = await Store.RoomProfile.created.query(ctx, {
                    afterCursor: roomsQuery.cursor,
                    limit: 1000,
                });
                items = items.concat(roomsQuery.items);
            }

            let rooms = items
                .filter(a => a.activeMembersCount && a.activeMembersCount >= 10)
                .sort((a, b) => b.activeMembersCount! - a.activeMembersCount!)
                .slice(0, 10);

            let message = [heading('New groups with 10 plus members'), '\n'];
            for (let i = 0; i < rooms.length; i++) {
                let room = rooms[i];
                let messagesCount = await Store.RoomMessagesCounter.byId(room.id).get(ctx);
                message.push(`${i + 1}. ${room.title} (👥 ${room.activeMembersCount}, ➡️ ${messagesCount})\n`);
            }

            await Modules.Messaging.sendMessage(ctx, chatId!, botId!, {
                ...buildMessage(...message), ignoreAugmentation: true,
            });

            return { result: 'completed' };
        });
    }
    return queue;
}