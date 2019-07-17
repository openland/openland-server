import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from '../openland-module-db/FDB';
import { createWeeklyEngagementReportWorker } from './workers/WeeklyEngagementReportWorker';
import { createWeeklyOnboardingReportWorker } from './workers/WeeklyOnboardingReportWorker';
import { createDailyOnboardingReportWorker } from './workers/DailyOnboardingReportWorker';
import { createDailyEngagementReportWorker } from './workers/DailyEngagementReportWorker';
import { createWeeklyUserLeaderboardsWorker } from './workers/WeeklyUserLeaderboardsWorker';
import { createWeeklyRoomLeaderboardsWorker } from './workers/WeeklyRoomLeaderboardsWorker';

@injectable()
export class StatsModule {
    public readonly weeklyEngagementQueue = createWeeklyEngagementReportWorker();
    public readonly weeklyOnboardingQueue = createWeeklyOnboardingReportWorker();
    public readonly dailyOnboardingQueue = createDailyOnboardingReportWorker();
    public readonly dailyEngagementQueue = createDailyEngagementReportWorker();
    public readonly weeklyUserLeaderboardsQueue = createWeeklyUserLeaderboardsWorker();
    public readonly weeklyRoomLeaderboardsQueue = createWeeklyRoomLeaderboardsWorker();

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
}