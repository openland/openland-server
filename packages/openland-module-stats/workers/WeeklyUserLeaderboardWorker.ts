import { Modules } from '../../openland-modules/Modules';
import { ScheduledQueue, WeekDay } from '../../openland-module-workers/ScheduledQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { getLeaderboardsChatId, getSuperNotificationsBotId } from './utils';
import { Store } from '../../openland-module-db/FDB';
import { boldString, buildMessage, heading, userMention } from '../../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';
import { UserProfile } from '../../openland-module-db/store';

const log = createLogger('weekly-user-leaderboards');

export function createWeeklyUserLeaderboardWorker() {
    let queue = new ScheduledQueue('weekly-user-leaderboards',  {
        interval: 'every-week',
        time: { weekDay: WeekDay.Monday, hours: 10, minutes: 0 },
    });
    if (serverRoleEnabled('workers')) {
        queue.addWorker(async (parent) => {
            const chatId = await getLeaderboardsChatId(parent);
            const botId = await getSuperNotificationsBotId(parent);
            if (!chatId || !botId) {
                log.warn(parent, 'botId or chatId not specified');
                return;
            }

            let searchReq = await Modules.Search.elastic.client.search({
                index: 'hyperlog', type: 'hyperlog',
                // scroll: '1m',
                body: {
                    query: {
                        bool: {
                            must: [{ term: { type: 'successful-invite' } }, {
                                range: {
                                    date: {
                                        gte: Date.now() - 7 * 24 * 60 * 60 * 1000,
                                    },
                                },
                            }],
                        },
                    },
                    aggs: {
                        byInviter: {
                            terms: {
                                field: 'body.invitedBy',
                                size: 30,
                                order: { ['_count'] : 'desc' },
                            },
                        },
                    },
                },
                size: 0,
            });
            
            let usersWithInvites: { invites: number, user: UserProfile }[] = [];
            for (let bucket of searchReq.aggregations.byInviter.buckets) {
                let user = await Store.UserProfile.findById(parent, bucket.key);
                if (!user) {
                    continue;
                }

                usersWithInvites.push({
                    invites: bucket.doc_count,
                    user: user,
                });
            }

            usersWithInvites = usersWithInvites.slice(0, 20);

            let message = [heading('👋  Weekly top inviters'), '\n'];
            for (let { user, invites } of usersWithInvites) {
                message.push(boldString(`${invites}`), ` `, userMention([user.firstName, user.lastName].join(' '), user.id), `\n`);
            }

            await Modules.Messaging.sendMessage(parent, chatId!, botId!, {
                ...buildMessage(...message), ignoreAugmentation: true,
            });
        });
    }
    return queue;
}