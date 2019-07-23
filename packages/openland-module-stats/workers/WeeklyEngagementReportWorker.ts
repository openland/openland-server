import { ScheduledQueue, WeekDay } from '../../openland-module-workers/ScheduledQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { getEngagementReportsChatId, getSuperNotificationsBotId } from './utils';
import { createLogger } from '@openland/log';
import { Modules } from '../../openland-modules/Modules';
import { buildMessage, heading } from '../../openland-utils/MessageBuilder';
import { inTx } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';

const log = createLogger('weekly-engagement-report');

export function createWeeklyEngagementReportWorker() {
    let queue = new ScheduledQueue('weekly-engagement', {
        interval: 'every-week', time: { weekDay: WeekDay.Monday, hours: 10, minutes: 0 },
    });

    if (serverRoleEnabled('workers')) {
        queue.addWorker(async (parent) => {
            const chatId = await getEngagementReportsChatId(parent);
            const botId = await getSuperNotificationsBotId(parent);
            if (!chatId || !botId) {
                log.warn(parent, 'botId or chatId not specified');
                return { result: 'rejected' };
            }

            let activesData = await Modules.Search.elastic.client.search({
                index: 'hyperlog', type: 'hyperlog', // scroll: '1m',
                body: {
                    query: {
                        bool: {
                            must: [{ term: { type: 'presence' } }, { term: { ['body.online']: true } }, {
                                range: {
                                    date: {
                                        gte: Date.now() - 7 * 24 * 60 * 60 * 1000,
                                    },
                                },
                            }],
                        },
                    }, aggs: {
                        actives: {
                            cardinality: {
                                field: 'body.uid',
                            },
                        },
                    },
                }, size: 0,
            });

            let actives = activesData.aggregations.actives.value;

            let sendersData = await Modules.Search.elastic.client.search({
                index: 'message', type: 'message',
                body: {
                    query: {
                        bool: {
                            must: [{ term: { isService: false } }, {
                                range: {
                                    createdAt: {
                                        gte: Date.now() - 7 * 24 * 60 * 60 * 1000,
                                    },
                                },
                            }],
                        },
                    }, aggs: {
                        senders: {
                            cardinality: {
                                field: 'uid',
                            },
                        }
                    },
                }, size: 0,
            });

            let senders = sendersData.aggregations.senders.value;
            let messagesSent = sendersData.hits.total;
            let totalPeople = await inTx(parent, ctx => Store.Sequence.findById(ctx, 'user-id'));
            const report = [heading(`Weekly   👪 ${totalPeople ? totalPeople.value : 0}   👩‍💻 ${actives}    ➡️ ${senders}    ✉️ ${messagesSent}`)];

            await Modules.Messaging.sendMessage(parent, chatId!, botId!, {
                ...buildMessage(...report), ignoreAugmentation: true,
            });

            return { result: 'completed' };
        });
    }
    return queue;

}