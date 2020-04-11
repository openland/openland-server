import { Modules } from '../../openland-modules/Modules';
import { ScheduledQueue, WeekDay } from '../../openland-module-workers/ScheduledQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { getLeaderboardsChatId, getSuperNotificationsBotId } from './utils';
import { Store } from '../../openland-module-db/FDB';
import { boldString, buildMessage, heading, roomMention } from '../../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';
import { RoomProfile } from '../../openland-module-db/store';
import { formatNumberWithSign } from '../../openland-utils/string';

const log = createLogger('weekly-room-leaderboards');

export function createWeeklyRoomLeaderboardWorker() {
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

            let searchReq = await Modules.Search.elastic.client.search({
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
                                },
                                totalDeltaFilter: {
                                    bucket_selector: {
                                        buckets_path: {
                                            totalDelta: 'totalDelta'
                                        },
                                        script: 'params.totalDelta >= 10'
                                    }
                                }
                            }
                        },
                    },
                },
                size: 0,
            });

            let roomsWithDelta: { room: RoomProfile, delta: number }[] = [];
            for (let bucket of searchReq.aggregations.byRid.buckets) {
                let rid = bucket.key;
                let delta = bucket.totalDelta.value;
                let room =  await Store.RoomProfile.findById(parent, rid);
                let conv = await Store.ConversationRoom.findById(parent, rid);

                if (!room || !conv || !conv.oid) {
                    continue;
                }

                let org = await Store.Organization.findById(parent, conv.oid);
                let isListed = conv!.kind === 'public' && org && org.kind === 'community' && !org.private;
                if (!isListed || conv.isChannel) {
                    continue;
                }

                roomsWithDelta.push({
                    room: room,
                    delta: delta,
                });
            }
            roomsWithDelta = roomsWithDelta
                .sort((a, b) => (b.delta / b.room.activeMembersCount!) - (a.delta / a.room.activeMembersCount!))
                .slice(0, 20);

            let message = [heading('👥  Weekly trending groups'), '\n'];
            for (let { room, delta } of roomsWithDelta) {
                message.push(boldString(`${formatNumberWithSign(delta)} · ${room.activeMembersCount}  `), roomMention(room.title, room.id), `\n`);
            }

            await Modules.Messaging.sendMessage(parent, chatId!, botId!, {
                ...buildMessage(...message), ignoreAugmentation: true,
            });

            return { result: 'completed' };
        });
    }
    return queue;
}