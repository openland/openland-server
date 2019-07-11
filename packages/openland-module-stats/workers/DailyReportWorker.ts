import { timedWorker } from '../../openland-module-workers/timedWorker';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { Modules } from '../../openland-modules/Modules';

export function createDailyReportWorker() {
    if (serverRoleEnabled('workers')) {
        timedWorker('daily-summary', {
            interval: 'every-day',
            time: { hours: 10, minutes: 0 },
        }, async (ctx) => {
            await Modules.Stats.generateDailyReport(ctx);
            return { result: 'completed' };
        });
    }
}