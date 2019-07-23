import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { Modules } from '../../openland-modules/Modules';
import { ScheduledQueue, WeekDay } from '../../openland-module-workers/ScheduledQueue';
import { buildMessage, heading } from '../../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';
import { getOnboardingReportsChatId, getSuperNotificationsBotId, getOnboardingCounters } from './utils';

const log = createLogger('weekly-onboarding-report');

export function createWeeklyOnboardingReportWorker() {
    let queue = new ScheduledQueue('weekly-onboarding', {
        interval: 'every-week',
        time: { weekDay: WeekDay.Monday, hours: 10, minutes: 0 },
    });
    if (serverRoleEnabled('workers')) {
        queue.addWorker(async (ctx) => {
            const chatId = await getOnboardingReportsChatId(ctx);
            const botId = await getSuperNotificationsBotId(ctx);
            if (!chatId || !botId) {
                log.warn(ctx, 'botId or chatId not specified');
                return { result: 'rejected' };
            }

            const currentStats = getOnboardingCounters();
            const prevWeekStats = getOnboardingCounters('prev-week-onboarding');

            let activationsData = await Modules.Search.elastic.client.search({
                index: 'hyperlog', type: 'hyperlog', // scroll: '1m',
                body: {
                    query: {
                        bool: {
                            must: [{ term: { type: 'user_activated' } }, {
                                range: {
                                    date: {
                                        gte: Date.now() - 7 * 24 * 60 * 60 * 1000,
                                    },
                                },
                            }],
                        },
                    }, aggs: {
                        activations: {
                            cardinality: {
                                field: 'body.uid',
                            },
                        },
                    },
                }, size: 0,
            });

            let newUserEntrances = activationsData.aggregations.activations.value;

            const mobileUsers = await currentStats.mobileUsers.get(ctx);
            const yesterdayMobileUsers = await prevWeekStats.mobileUsers.get(ctx);
            const newMobileUsers = mobileUsers - yesterdayMobileUsers;
            prevWeekStats.mobileUsers.set(ctx, mobileUsers);

            const senders =  await currentStats.senders.get(ctx);
            const yesterdaySenders = await prevWeekStats.senders.get(ctx);
            const newSenders = senders - yesterdaySenders;
            prevWeekStats.senders.set(ctx, senders);

            const inviters = await currentStats.inviters.get(ctx);
            const yesterdayInviters = await prevWeekStats.inviters.get(ctx);
            const newInviters = inviters - yesterdayInviters;
            prevWeekStats.inviters.set(ctx, inviters);

            const report = [heading(`Weekly   🐥 ${newUserEntrances}   📱 ${newMobileUsers}    ➡️ ${newSenders}    🙌 ${newInviters}`)];

            await Modules.Messaging.sendMessage(ctx, chatId!, botId!, {
                ...buildMessage(...report), ignoreAugmentation: true,
            });
            return { result: 'completed' };
        });
    }
    return queue;
}