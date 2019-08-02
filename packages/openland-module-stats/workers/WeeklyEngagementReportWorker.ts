import { ScheduledQueue, WeekDay } from '../../openland-module-workers/ScheduledQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { getEngagementCounters, getEngagementReportsChatId, getSuperNotificationsBotId } from './utils';
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

            let counters = await getEngagementCounters(Date.now() - 7 * 24 * 60 * 60 * 1000);
            let totalPeople = await inTx(parent, ctx => Store.Sequence.findById(ctx, 'user-id'));

            const report = [heading([
                `Weekly`,
                `👪 ${totalPeople ? totalPeople.value : 0}`,
                `👩‍💻 ${counters.actives}`,
                `➡️ ${counters.senders}`,
                `✉️ ${counters.messagesSent}`,
                `🗣 ${counters.newAboutFillers}`,
                `❤️ ${counters.todayLikeGivers}`,
                `🙃 ${counters.todayLikeGetters}`
            ].join('   '))];

            await Modules.Messaging.sendMessage(parent, chatId!, botId!, {
                ...buildMessage(...report), ignoreAugmentation: true,
            });

            return { result: 'completed' };
        });
    }
    return queue;

}