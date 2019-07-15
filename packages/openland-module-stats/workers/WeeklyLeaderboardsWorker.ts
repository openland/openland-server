import { timedWorker, WeekDay } from '../../openland-module-workers/timedWorker';
import { Modules } from '../../openland-modules/Modules';

export function createWeeklyLeaderboardsWorker() {
    return timedWorker('weekly-leaderboards', {
        interval: 'every-week', time: { weekDay: WeekDay.Monday, hours: 10, minutes: 0 },
    }, async (ctx) => {
        await Modules.Stats.generateWeeklyRoomLeaderboards(ctx);
        await Modules.Stats.generateWeeklyUserLeaderboards(ctx);

        return { result: 'completed' };
    });

}