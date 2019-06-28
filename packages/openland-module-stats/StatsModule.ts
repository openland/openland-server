import { injectable } from 'inversify';
import { createFirstWeekReportWorker } from './workers/FirstWeekReportWorker';
import { createSilentUserReportWorker } from './workers/SilentUserReportWorker';
import { Context } from '@openland/context';
import { createWeeklyReportWorker } from './workers/WeeklyReportWorker';
import { createDailyReportWorker } from './workers/DailyReportWorker';
import { Store } from '../openland-module-db/FDB';

@injectable()
export class StatsModule {
    private readonly firstWeekReportQueue = createFirstWeekReportWorker();
    private readonly silentUserReportQueue = createSilentUserReportWorker();

    start = () => {
        createDailyReportWorker();
        createWeeklyReportWorker();
    }

    queueFirstWeekReport = (ctx: Context, uid: number) => {
        return this.firstWeekReportQueue.pushWork(ctx, { uid }, Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
    }

    queueSilentUserReport = (ctx: Context, uid: number) => {
        return this.silentUserReportQueue.pushWork(ctx, { uid }, Date.now() + 1000 * 60 * 60 * 24 * 2); // 2 days
    }

    onNewMobileUser = (ctx: Context) => {
        Store.GlobalStatisticsCounters.byId('mobile-users').increment(ctx);
    }

    onNewEntrance = (ctx: Context) => {
        Store.GlobalStatisticsCounters.byId('user-entrances').increment(ctx);
    }

    onSuccessfulInvite = (ctx: Context) => {
        Store.GlobalStatisticsCounters.byId('successful-invites').increment(ctx);
    }
}