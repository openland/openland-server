import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { Modules } from '../../openland-modules/Modules';
import { ScheduledQueue, WeekDay } from '../../openland-module-workers/ScheduledQueue';
import { buildMessage, heading } from '../../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';
import { getOnboardingReportsChatId, getSuperNotificationsBotId } from './utils';
import { inTx } from '@openland/foundationdb';

const log = createLogger('weekly-onboarding-report');

export function createWeeklyOnboardingReportWorker() {
    let queue = new ScheduledQueue('weekly-onboarding', {
        interval: 'every-week',
        time: { weekDay: WeekDay.Monday, hours: 10, minutes: 0 },
    });
    if (serverRoleEnabled('workers')) {
        queue.addWorker((parent) => {
            return inTx(parent, async ctx => {
                const chatId = await getOnboardingReportsChatId(ctx);
                const botId = await getSuperNotificationsBotId(ctx);
                if (!chatId || !botId) {
                    log.warn(ctx, 'botId or chatId not specified');
                    return { result: 'rejected' };
                }

                let startDate = Date.now() - 7 * 24 * 60 * 60 * 1000;
                let activationsData = await Modules.Search.elastic.client.search({
                    index: 'hyperlog', type: 'hyperlog', // scroll: '1m',
                    body: {
                        query: {
                            bool: {
                                must: [{ term: { type: 'user_activated' } }, {
                                    range: {
                                        date: {
                                            gte: startDate,
                                        },
                                    },
                                }],
                            },
                        },
                    }, size: 0,
                });

                let newUserEntrances = activationsData.hits.total;

                const newMobileUsersQuery = await Modules.Search.elastic.client.search({
                    index: 'hyperlog', type: 'hyperlog',
                    body: {
                        query: {
                            bool: {
                                must: [{ term: { type: 'new-mobile-user' } }, {
                                    range: {
                                        date: {
                                            gte: startDate
                                        }
                                    }
                                }]
                            }
                        }
                    },
                    size: 0
                });
                const newMobileUsers = newMobileUsersQuery.hits.total;

                const newSendersQuery = await Modules.Search.elastic.client.search({
                    index: 'hyperlog', type: 'hyperlog',
                    body: {
                        query: {
                            bool: {
                                must: [{ term: { type: 'new-sender' } }, {
                                    range: {
                                        date: {
                                            gte: startDate
                                        }
                                    }
                                }]
                            }
                        }
                    },
                    size: 0
                });
                const newSenders = newSendersQuery.hits.total;

                const newInvitersQuery = await Modules.Search.elastic.client.search({
                    index: 'hyperlog', type: 'hyperlog',
                    body: {
                        query: {
                            bool: {
                                must: [{ term: { type: 'new-inviter' } }, {
                                    range: {
                                        date: {
                                            gte: startDate
                                        }
                                    }
                                }]
                            }
                        }
                    },
                    size: 0
                });
                const newInviters = newInvitersQuery.hits.total;

                const report = [heading(`Weekly   🐥 ${newUserEntrances}   📱 ${newMobileUsers}    ➡️ ${newSenders}    🙌 ${newInviters}`)];

                await Modules.Messaging.sendMessage(ctx, chatId!, botId!, {
                    ...buildMessage(...report), ignoreAugmentation: true,
                });
                return { result: 'completed' };
            });
        });
    }
    return queue;
}