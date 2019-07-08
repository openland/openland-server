import { timedWorker, WeekDay } from '../../openland-module-workers/timedWorker';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { Modules } from '../../openland-modules/Modules';

export function createWeeklyReportWorker() {
    if (serverRoleEnabled('workers')) {
        timedWorker('weekly-summary', {
            interval: 'every-week',
            time: { weekDay: WeekDay.Monday, hours: 10, minutes: 0 }
        }, async (ctx) => {
            await Modules.Stats.generateWeeklyReport(ctx);

            return { result: 'completed' };
        });
    }
}