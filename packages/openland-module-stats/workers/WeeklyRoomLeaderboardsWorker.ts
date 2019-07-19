import { Modules } from '../../openland-modules/Modules';
import { ScheduledQueue, WeekDay } from '../../openland-module-workers/ScheduledQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { getLeaderboardsChatId, getSuperNotificationsBotId } from './utils';
import { Store } from '../../openland-module-db/FDB';
import { boldString, buildMessage, heading } from '../../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';
import { RoomProfile } from '../../openland-module-db/store';
import { formatNumberWithSign } from '../../openland-utils/string';

const log = createLogger('weekly-room-leaderboards');

export function createWeeklyRoomLeaderboardsWorker() {
    let queue = new ScheduledQueue('weekly-room-leaderboards', {
        interval: 'every-week', time: { weekDay: WeekDay.Monday, hours: 10, minutes: 0 },
    });
    if (serverRoleEnabled('workers')) {
        queue.addWorker(async (parent) => {
            const chatId = await getLeaderboardsChatId(parent);
            const botId = await getSuperNotificationsBotId(parent);
            if (!chatId || !botId) {
                log.warn(parent, 'botId or chatId not specified');
                return { result: 'rejected' };
            }

            let data = await Modules.Search.elastic.client.search({
                index: 'hyperlog', type: 'hyperlog', body: {
                    query: {
                        bool: {
                            must: [{ term: { type: 'room-members-change' } }, {
                                range: {
                                    date: {
                                        gte: new Date().setHours(-24 * 7),
                                    },
                                },
                            }],
                        },
                    },
                },
            });

            let membersDelta = new Map<number, number>();
            for (let hit of data.hits.hits) {
                let { rid, delta } = (hit._source as any).body;
                membersDelta.set(rid, (membersDelta.get(rid) || 0) + delta);
            }

            let roomsWithDelta: { room: RoomProfile, delta: number }[] = [];
            for (let roomEntry of  membersDelta.entries()) {
                let [rid, delta] = roomEntry;
                let room = await Store.RoomProfile.findById(parent, rid);
                roomsWithDelta.push({
                    room: room!, delta,
                });
            }
            roomsWithDelta = roomsWithDelta
                .sort((a, b) => (b.delta / b.room.activeMembersCount!) - (a.delta / a.room.activeMembersCount!))
                .slice(0, 20);

            let message = [heading('👥  Weekly trending groups'), '\n'];
            for (let i = 0; i < roomsWithDelta.length; i++) {
                let { room, delta } = roomsWithDelta[i];
                message.push(boldString(`${formatNumberWithSign(delta)} · ${room.activeMembersCount}`), `  ${room.title}\n`);
            }

            await Modules.Messaging.sendMessage(parent, chatId!, botId!, {
                ...buildMessage(...message), ignoreAugmentation: true,
            });

            return { result: 'completed' };
        });
    }
    return queue;
}