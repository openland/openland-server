import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { Modules } from '../../openland-modules/Modules';
import { inTx } from '@openland/foundationdb';
import { ScheduledQueue } from '../../openland-module-workers/ScheduledQueue';
import { getOnboardingReportsChatId, getSuperNotificationsBotId } from './utils';
import { buildMessage, heading } from '../../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';

const log = createLogger('daily-onboarding-report');

export function createDailyOnboardingReportWorker() {
    let queue = new ScheduledQueue('daily-onboarding', {
        interval: 'every-day', time: { hours: 10, minutes: 0 },
    });
    if (serverRoleEnabled('workers')) {
        queue.addWorker(async (parent) => {
            return await inTx(parent, async ctx => {
                const chatId = await getOnboardingReportsChatId(ctx);
                const botId = await getSuperNotificationsBotId(ctx);
                if (!chatId || !botId) {
                    log.warn(ctx, 'botId or chatId not specified');
                    return { result: 'rejected' };
                }

                let startDate = Date.now() - 24 * 60 * 60 * 1000;
                let activationsData = await Modules.Search.elastic.client.search({
                    index: 'hyperlog', type: 'hyperlog', // scroll: '1m',
                    body: {
                        query: {
                            bool: {
                                must: [{ term: { type: 'user_activated' } }, { term: { ['body.isTest']: false } }, {
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
                    index: 'hyperlog', type: 'hyperlog', body: {
                        query: {
                            bool: {
                                must: [{ term: { type: 'new-mobile-user' } }, { term: { ['body.isTest']: false } }, {
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
                const newMobileUsers = newMobileUsersQuery.hits.total;

                const newSendersQuery = await Modules.Search.elastic.client.search({
                    index: 'hyperlog', type: 'hyperlog', body: {
                        query: {
                            bool: {
                                must: [{ term: { type: 'new-sender' } }, { term: { ['body.isTest']: false } }, {
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
                const newSenders = newSendersQuery.hits.total;

                const newInvitersQuery = await Modules.Search.elastic.client.search({
                    index: 'hyperlog', type: 'hyperlog', body: {
                        query: {
                            bool: {
                                must: [{ term: { type: 'new-inviter' } }, { term: { ['body.isTest']: false } }, {
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
                const newInviters = newInvitersQuery.hits.total;

                const newThreeLikeGiversQuery = await Modules.Search.elastic.client.search({
                    index: 'hyperlog', type: 'hyperlog', body: {
                        query: {
                            bool: {
                                must: [{ term: { type: 'new-three-like-giver' } }, {
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
                const newThreeLikeGivers = newThreeLikeGiversQuery.hits.total;

                const newThreeLikeGettersQuery = await Modules.Search.elastic.client.search({
                    index: 'hyperlog', type: 'hyperlog', body: {
                        query: {
                            bool: {
                                must: [{ term: { type: 'new-three-like-getter' } }, {
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
                const newThreeLikeGetters = newThreeLikeGettersQuery.hits.total;

                const report = [heading([
                    `Daily`,
                    `🐥 ${newUserEntrances}`,
                    `📱 ${newMobileUsers}`,
                    `➡️ ${newSenders}`,
                    `🙌 ${newInviters}`,
                    `❤️ ${newThreeLikeGivers}`,
                    `🙃 ${newThreeLikeGetters}`
                ].join('   '))];

                await Modules.Messaging.sendMessage(ctx, chatId!, botId!, {
                    ...buildMessage(...report), ignoreAugmentation: true,
                });
                return { result: 'completed' };
            });

        });
    }
    return queue;
}