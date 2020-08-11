// import { Modules } from '../../openland-modules/Modules';
// import { ScheduledQueue } from '../../openland-module-workers/ScheduledQueue';
// import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
// import { getLeaderboardsChatId, getSuperNotificationsBotId } from './utils';
// import { Store } from '../../openland-module-db/FDB';
// import { boldString, buildMessage, heading, roomMention } from '../../openland-utils/MessageBuilder';
// import { createLogger } from '@openland/log';
// import { RoomProfile } from '../../openland-module-db/store';
// import { formatMoney, formatMoneyWithInterval } from '../../openland-module-wallet/repo/utils/formatMoney';
// import { plural } from '../../openland-utils/string';
//
// const log = createLogger('daily-paid-leaderboards');
//
// export function createDailyPaidLeaderboardWorker() {
//     let queue = new ScheduledQueue('daily-paid-leaderboards',  {
//         interval: 'every-day',
//         time: { hours: 10, minutes: 0 },
//     });
//     if (serverRoleEnabled('workers')) {
//         queue.addWorker(async (parent) => {
//             const chatId = await getLeaderboardsChatId(parent);
//             const botId = await getSuperNotificationsBotId(parent);
//             if (!chatId || !botId) {
//                 log.warn(parent, 'botId or chatId not specified');
//                 return;
//             }
//
//             let searchReq = await Modules.Search.elastic.client.msearch({
//                 body: [
//                     { index: 'hyperlog', type: 'hyperlog' }, {
//                         size: 0, query: {
//                             bool: {
//                                 must: [{ term: { type: 'wallet_event' } }, { term: { ['body.type']: 'payment_intent_success' } }, {
//                                     range: {
//                                         date: {
//                                             gte: Date.now() - 24 * 60 * 60 * 1000,
//                                         },
//                                     },
//                                 }],
//                             },
//                         }, aggs: {
//                             totalSales: {
//                                 sum: { field: 'body.body.amount' }
//                             }
//                         }
//                     },
//                     { index: 'hyperlog', type: 'hyperlog' },
//                     {
//                         size: 0,
//                         query: {
//                             bool: {
//                                 must: [
//                                     { term: { type: 'wallet_event' } }, {
//                                         bool: {
//                                             should: [
//                                                 { term: { ['body.type']: 'purchase_successful' } },
//                                                 { term: { ['body.type']: 'subscription_payment_success' } },
//                                                 ]
//                                         }
//                                     },
//                                     { term: { ['body.body.product.type']: 'group' } },
//                                     {
//                                         range: {
//                                             date: {
//                                                 gte: Date.now() - 24 * 60 * 60 * 1000,
//                                             },
//                                         },
//                                     }],
//                             },
//                         },
//                         aggs: {
//                             byGid: {
//                                 terms: {
//                                     field: 'body.body.product.gid',
//                                     size: 50,
//                                     order: { ['_count'] : 'desc' },
//                                 },
//                             },
//                         },
//                     },
//                     { index: 'hyperlog', type: 'hyperlog' },
//                     {
//                         size: 0,
//                         query: {
//                             bool: {
//                                 must: [
//                                     { term: { type: 'wallet_event' } },
//                                     { term: { ['body.type']: 'subscription_started' } },
//                                     { term: { ['body.body.product.type']: 'group' } },
//                                     {
//                                         range: {
//                                             date: {
//                                                 gte: Date.now() - 24 * 60 * 60 * 1000,
//                                             },
//                                         },
//                                     }
//                                 ]
//                             }
//                         },
//                         aggs: {
//                             byGid: {
//                                 terms: {
//                                     field: 'body.body.product.gid',
//                                     size: 50,
//                                     order: { ['_count'] : 'desc' },
//                                 },
//                             },
//                         },
//                     }
//                 ]
//             });
//
//             let totalSales = searchReq.responses![0].aggregations.totalSales.value;
//
//             let oneTimeGroups: { purchases: number, room: RoomProfile, price: string }[] = [];
//             let subscriptionGroups: { purchases: number, room: RoomProfile, price: string }[] = [];
//             for (let bucket of searchReq.responses![1].aggregations.byGid.buckets) {
//                 let room = await Store.RoomProfile.findById(parent, bucket.key);
//                 let settings = await Store.PremiumChatSettings.findById(parent, bucket.key);
//                 if (!room || !settings) {
//                     continue;
//                 }
//
//                 if (!settings.interval) {
//                     oneTimeGroups.push({
//                         purchases: bucket.doc_count,
//                         room: room,
//                         price: formatMoneyWithInterval(settings.price, settings.interval)
//                     });
//                 } else {
//                     subscriptionGroups.push({
//                         purchases: bucket.doc_count,
//                         room: room,
//                         price: formatMoneyWithInterval(settings.price, settings.interval)
//                     });
//                 }
//             }
//
//             let newSubsByGroup = new Map<number, number>();
//             for (let bucket of searchReq.responses![2].aggregations.byGid.buckets) {
//                 newSubsByGroup.set(bucket.key, bucket.doc_count);
//             }
//
//             oneTimeGroups = oneTimeGroups.slice(0, 20);
//             subscriptionGroups = subscriptionGroups.slice(0, 20);
//
//             let message = [heading('💎  Daily revenue'), '\n',
//                 boldString(formatMoney(totalSales)), ' · Total daily sales', '\n\n',
//                 boldString('One-time payments'), '\n'
//             ];
//             for (let { purchases, room, price } of oneTimeGroups) {
//                 message.push(`${purchases}`, ` · `, roomMention(room.title, room.id), ` · `, price, `\n`);
//             }
//
//             message.push('\n', boldString('Subscriptions'), '\n');
//             for (let { purchases, room, price } of subscriptionGroups) {
//                 let subs = newSubsByGroup.get(room.id) || 0;
//                 message.push(`${purchases}`, ` · `, roomMention(room.title, room.id), ` · `, price, ` · ${subs} new ${plural(subs, ['sub', 'subs'])}\n`);
//             }
//
//             await Modules.Messaging.sendMessage(parent, chatId!, botId!, {
//                 ...buildMessage(...message), ignoreAugmentation: true,
//             });
//         });
//     }
//     return queue;
// }