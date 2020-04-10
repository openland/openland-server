import { Modules } from '../../openland-modules/Modules';
import { ScheduledQueue, WeekDay } from '../../openland-module-workers/ScheduledQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { getLeaderboardsChatId, getSuperNotificationsBotId } from './utils';
import { boldString, buildMessage, heading, roomMention } from '../../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';
import { formatNumberWithSign } from '../../openland-utils/string';

const log = createLogger('weekly-room-leaderboards');

export function createWeeklyRoomByMessagesLeaderboardWorker() {
    let queue = new ScheduledQueue('weekly-room-by-message-leaderboard', {
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

            let roomsWithDelta = await Modules.Stats
                .getTrendingRoomsByMessages(parent, Date.now() - 7 * 24 * 60 * 60 * 1000, Date.now(), 20);

            let roomMembersDelta = await Modules.Search.elastic.client.search({
                index: 'hyperlog', type: 'hyperlog',
                // scroll: '1m',
                body: {
                    query: {
                        bool: {
                            must: [{ term: { type: 'room-members-change' } }, {
                                range: {
                                    date: {
                                        gte: Date.now() - 7 * 24 * 60 * 60 * 1000,
                                    },
                                },
                            }, {
                                bool: {
                                    should: roomsWithDelta.map(e => ({ term: { ['body.rid']: e.room.id } }))
                                }
                            }],
                        },
                    },
                    aggs: {
                        byRid: {
                            terms: {
                                field: 'body.rid',
                                size: 10000
                            },
                            aggs: {
                                totalDelta: {
                                    sum: {
                                        field: 'body.delta'
                                    }
                                }
                            }
                        },
                    },
                },
                size: 0,
            });

            let members = roomMembersDelta.aggregations.byRid.buckets.reduce((acc: Map<number, number>, a: any) => acc.set(a.key, a.totalDelta.value), new Map<number, number>());

            let message = [heading('👥  Weekly groups by messages'), '\n'];
            for (let { room, messagesDelta } of roomsWithDelta) {
                message.push(boldString(`${formatNumberWithSign(messagesDelta)} · ${formatNumberWithSign(members.get(room.id) || 0)} · ${room.activeMembersCount}  `), roomMention(room.title, room.id), `\n`);
            }

            await Modules.Messaging.sendMessage(parent, chatId!, botId!, {
                ...buildMessage(...message), ignoreAugmentation: true,
            });

            return { result: 'completed' };
        });
    }
    return queue;
}