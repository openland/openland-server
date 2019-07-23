import { ScheduledQueue } from '../../openland-module-workers/ScheduledQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { Modules } from '../../openland-modules/Modules';
import { buildMessage, heading } from '../../openland-utils/MessageBuilder';
import { getEngagementReportsChatId, getSuperNotificationsBotId } from './utils';
import { createLogger } from '@openland/log';

const log = createLogger('weekly-engagement-report');
export function createDailyEngagementReportWorker() {
    let queue = new ScheduledQueue('daily-engagement', {
        interval: 'every-day', time: { hours: 10, minutes: 0 },
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
                                        gte: new Date().setHours(-24),
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
                            must: [{
                                range: {
                                    createdAt: {
                                        gte: new Date().setHours(-24),
                                    },
                                },
                            }],
                        },
                    }, aggs: {
                        senders: {
                            cardinality: {
                                field: 'uid',
                            },
                        },
                        messagesSent: {
                            value_count: {
                                field: 'id'
                            }
                        }
                    },
                }, size: 0,
            });

            let senders = sendersData.aggregations.senders.value;
            let messagesSent = sendersData.aggregations.messagesSent.value;
            const report = [heading(`Daily   ✅ ${actives}    ➡️ ${senders}    📭 ${messagesSent}`)];

            await Modules.Messaging.sendMessage(parent, chatId!, botId!, {
                ...buildMessage(...report), ignoreAugmentation: true,
            });

            return { result: 'completed' };
        });
    }
    return queue;
}