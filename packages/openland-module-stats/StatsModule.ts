import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from '../openland-module-db/FDB';
import { createWeeklyEngagementReportWorker } from './workers/WeeklyEngagementReportWorker';
import { createWeeklyOnboardingReportWorker } from './workers/WeeklyOnboardingReportWorker';
import { createDailyOnboardingReportWorker } from './workers/DailyOnboardingReportWorker';
import { createDailyEngagementReportWorker } from './workers/DailyEngagementReportWorker';
import { createWeeklyUserLeaderboardWorker } from './workers/WeeklyUserLeaderboardWorker';
import { createWeeklyRoomLeaderboardWorker } from './workers/WeeklyRoomLeaderboardWorker';
import { createWeeklyRoomByMessagesLeaderboardWorker } from './workers/WeeklyRoomByMessagesLeaderboardWorker';
import { Modules } from '../openland-modules/Modules';
import { RoomProfile } from '../openland-module-db/store';

@injectable()
export class StatsModule {
    public readonly weeklyEngagementQueue = createWeeklyEngagementReportWorker();
    public readonly weeklyOnboardingQueue = createWeeklyOnboardingReportWorker();
    public readonly dailyOnboardingQueue = createDailyOnboardingReportWorker();
    public readonly dailyEngagementQueue = createDailyEngagementReportWorker();
    public readonly weeklyUserLeaderboardQueue = createWeeklyUserLeaderboardWorker();
    public readonly weeklyRoomLeaderboardQueue = createWeeklyRoomLeaderboardWorker();
    public readonly weeklyRoomByMessagesLeaderboardQueue = createWeeklyRoomByMessagesLeaderboardWorker();

    start = () => {
        // no op
    }

    onNewMobileUser = (ctx: Context) => {
        Store.GlobalStatisticsCounters.byId('mobile-users').increment(ctx);
    }

    onMessageSent = async (ctx: Context, uid: number) => {
        Store.GlobalStatisticsCounters.byId('messages').increment(ctx);
        if (await Store.UserMessagesSentCounter.get(ctx, uid) === 1) {
            Store.GlobalStatisticsCounters.byId('senders').increment(ctx);
        }
    }

    onRoomMessageSent = (ctx: Context, rid: number) => {
        Store.RoomMessagesCounter.byId(rid).increment(ctx);
    }

    onNewEntrance = (ctx: Context) => {
        Store.GlobalStatisticsCounters.byId('user-entrances').increment(ctx);
    }

    onEmailSent = (ctx: Context, uid: number) => {
        Store.UserEmailSentCounter.byId(uid).increment(ctx);
    }

    onSuccessfulInvite = async (ctx: Context, newUserId: number, inviterId: number) => {
        Store.GlobalStatisticsCounters.byId('successful-invites').increment(ctx);

        let invitesCnt = await Store.UserSuccessfulInvitesCounter.byId(inviterId).get(ctx);
        if (invitesCnt === 1) {
            Store.GlobalStatisticsCounters.byId('inviters').increment(ctx);
        }
    }

    getTrendingRoomsByMessages = async (ctx: Context, from: number, to: number, size?: number) => {
        let searchReq = await Modules.Search.elastic.client.search({
            index: 'message', type: 'message', // scroll: '1m',
            body: {
                query: {
                    bool: {
                        must: [{ term: { roomKind: 'room' } }, { term: { isService: false } }, {
                            range: {
                                createdAt: {
                                    gte: from,
                                    lte: to
                                },
                            },
                        }],
                    },
                }, aggs: {
                    byCid: {
                        terms: {
                            field: 'cid',
                            size: Math.pow(10, 9),
                            order: { _count: 'desc' },
                        },
                    },
                },
            },
            size: 0,
        });

        let roomsWithDelta: { room: RoomProfile, messagesDelta: number }[] = [];
        for (let bucket of searchReq.aggregations.byCid.buckets) {
            let rid = bucket.key;
            let room = await Store.RoomProfile.findById(ctx, rid);
            let conv = await Store.ConversationRoom.findById(ctx, rid);

            if (!room || !conv || !conv.oid) {
                continue;
            }

            let org = await Store.Organization.findById(ctx, conv.oid);
            let isListed = conv!.kind === 'public' && org && org.kind === 'community' && !org.private;
            if (!isListed || conv.isChannel) {
                continue;
            }

            roomsWithDelta.push({
                room: room, messagesDelta: bucket.doc_count,
            });
            if (roomsWithDelta.length === size) {
                break;
            }
        }

        return roomsWithDelta;
    }
}