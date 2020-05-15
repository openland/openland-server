import { Modules } from '../../openland-modules/Modules';
import { ScheduledQueue, WeekDay } from '../../openland-module-workers/ScheduledQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { getLeaderboardsChatId, getSuperNotificationsBotId } from './utils';
import { boldString, buildMessage, heading, roomMention } from '../../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';
import { IDs } from '../../openland-module-api/IDs';
import { Store } from '../../openland-module-db/FDB';

const log = createLogger('weekly-room-screen-views-leaderboards');

export function createWeeklyRoomScreenViewsLeaderboardWorker() {
    let queue = new ScheduledQueue('weekly-room-screen-views-leaderboard', {
        interval: 'every-week', time: { weekDay: WeekDay.Monday, hours: 10, minutes: 0 },
    });
    if (serverRoleEnabled('workers')) {
        queue.addWorker(async (parent) => {
            const chatId = await getLeaderboardsChatId(parent);
            const botId = await getSuperNotificationsBotId(parent);
            if (!chatId || !botId) {
                log.warn(parent, 'botId or chatId not specified');
                return;
            }

            let roomMembersDelta = await Modules.Search.elastic.client.search({
                index: 'hyperlog', type: 'hyperlog',
                // scroll: '1m',
                body: {
                    query: {
                        bool: {
                            must: [
                                { term: { type: 'track' } },
                                { term: { ['body.isProd']: true } },
                                { term: { ['body.name']: 'invite_landing_view' } },
                                { term: { ['body.args.invite_type']: 'group' } }, {
                                range: {
                                    date: {
                                        gte: Date.now() - 7 * 24 * 60 * 60 * 1000,
                                    },
                                },
                            }],
                        },
                    },
                    aggs: {
                        byEid: {
                            terms: {
                                field: 'body.args.entity_id.keyword',
                                size: 10000,
                                order: { _count: 'desc' }
                            }
                        },
                    },
                },
                size: 0,
            });

            let roomsWithViews = roomMembersDelta.aggregations.byEid.buckets.reduce((acc: Map<number, number>, a: any) => acc.set(a.key, a.doc_count), new Map<number, number>());

            let message = [heading('👥  Weekly groups by group screen views'), '\n'];
            for (let [eid, views] of roomsWithViews.entries()) {
                try {
                    let cid = IDs.Conversation.parse(eid);
                    let room = await Store.RoomProfile.findById(parent, cid);
                    if (!room) {
                        continue;
                    }
                    message.push(boldString(`+${views} · ${room.activeMembersCount}  `), roomMention(room.title, room.id), `\n`);
                } catch {
                    log.warn(parent, 'Undefined entity: ' + eid);
                }
            }

            await Modules.Messaging.sendMessage(parent, chatId!, botId!, {
                ...buildMessage(...message), ignoreAugmentation: true,
            });
        });
    }
    return queue;
}