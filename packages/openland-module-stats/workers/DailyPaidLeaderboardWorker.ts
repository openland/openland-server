import { Modules } from '../../openland-modules/Modules';
import { ScheduledQueue, WeekDay } from '../../openland-module-workers/ScheduledQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { getLeaderboardsChatId, getSuperNotificationsBotId } from './utils';
import { Store } from '../../openland-module-db/FDB';
import { boldString, buildMessage, heading, roomMention } from '../../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';
import { PremiumChatSettings, RoomProfile } from '../../openland-module-db/store';

const log = createLogger('daily-paid-leaderboards');

function formatPrice(settings: PremiumChatSettings) {
    let postfix = '';
    if (settings.interval === 'week') {
        postfix = '/wk';
    } else if (settings.interval === 'month') {
        postfix = '/mo';
    }
    return`$${settings.price / 100}${postfix}`;
}

export function createDailyPaidLeaderboardWorker() {
    let queue = new ScheduledQueue('daily-paid-leaderboards',  {
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

            let searchReq = await Modules.Search.elastic.client.search({
                index: 'hyperlog', type: 'hyperlog',
                // scroll: '1m',
                body: {
                    query: {
                        bool: {
                            must: [
                                { term: { type: 'wallet_event' } },
                                { term: { ['body.type']: 'purchase_successful' } },
                                { term: { ['body.body.product.type']: 'group' } },
                                {
                                range: {
                                    date: {
                                        gte: Date.now() - 24 * 60 * 60 * 1000,
                                    },
                                },
                            }],
                        },
                    },
                    aggs: {
                        byGid: {
                            terms: {
                                field: 'body.body.product.gid',
                                size: 30,
                                order: { ['_count'] : 'desc' },
                            },
                        },
                    },
                },
                size: 0,
            });
            
            let groupsWithPurchases: { purchases: number, room: RoomProfile, price: string }[] = [];
            for (let bucket of searchReq.aggregations.byGid.buckets) {
                let room = await Store.RoomProfile.findById(parent, bucket.key);
                let settings = await Store.PremiumChatSettings.findById(parent, bucket.key);
                if (!room || !settings) {
                    continue;
                }

                groupsWithPurchases.push({
                    purchases: bucket.doc_count,
                    room: room,
                    price: formatPrice(settings)
                });
            }

            groupsWithPurchases = groupsWithPurchases.slice(0, 20);

            let message = [heading('👋  Daily top paid groups'), '\n'];
            for (let { purchases, room, price } of groupsWithPurchases) {
                message.push(boldString(`${purchases}`), ` · `, roomMention(room.title, room.id), ` · `, price, `\n`);
            }

            await Modules.Messaging.sendMessage(parent, chatId!, botId!, {
                ...buildMessage(...message), ignoreAugmentation: true,
            });
            return { result: 'completed' };
        });
    }
    return queue;
}