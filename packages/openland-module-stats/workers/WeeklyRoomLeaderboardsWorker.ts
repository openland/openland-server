import { Modules } from '../../openland-modules/Modules';
import { ScheduledQueue, WeekDay } from '../../openland-module-workers/ScheduledQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { getLeaderboardsChatId, getSuperNotificationsBotId } from './utils';
import { Store } from '../../openland-module-db/FDB';
import { buildMessage, heading } from '../../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';
import { RoomProfile } from '../../openland-module-db/store';
import { inTx } from '@openland/foundationdb';

const log = createLogger('weekly-room-leaderboards');

export function createWeeklyRoomLeaderboardsWorker() {
    let queue = new ScheduledQueue('weekly-room-leaderboards',  {
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

            let rooms = await inTx(parent, async ctx => await Store.RoomProfile.findAll(ctx));

            let roomsWithNewUsers: { users: number, room: RoomProfile }[] = [];
            for (let room of rooms) {
                await inTx(parent, async ctx => {
                    let prevWeekUsers = await Store.RoomActiveMembersPrevWeekCounter.byId(room.id).get(ctx);
                    let newUsers = room.activeMembersCount! - prevWeekUsers;
                    Store.RoomActiveMembersPrevWeekCounter.byId(room.id).set(ctx, room.activeMembersCount!);

                    roomsWithNewUsers.push({
                        users: newUsers,
                        room
                    });
                });
            }

            roomsWithNewUsers = roomsWithNewUsers
                .sort((a, b) => b.users! - a.users!)
                .slice(0, 20);

            let message = [heading('Top 20 groups by new members'), '\n'];
            for (let i = 0; i < rooms.length; i++) {
                let { room, users } = roomsWithNewUsers[i];
                message.push(`${i + 1}. ${room.title} (👥 ${users})\n`);
            }

            await Modules.Messaging.sendMessage(parent, chatId!, botId!, {
                ...buildMessage(...message), ignoreAugmentation: true,
            });

            return { result: 'completed' };
        });
    }
    return queue;
}