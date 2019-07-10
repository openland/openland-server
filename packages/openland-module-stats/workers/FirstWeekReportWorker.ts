import { Modules } from '../../openland-modules/Modules';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { WorkQueue } from '../../openland-module-workers/WorkQueue';

export function createFirstWeekReportWorker() {
    const q = new WorkQueue<{ uid: number }, { result: string }>('first-week-user-report');
    if (serverRoleEnabled('workers')) {
        q.addWorker(async (item, rootCtx) => {
            const { uid } = item;
            await Modules.Stats.generateFirstWeekUserReport(rootCtx, uid);
            return { result: 'completed' };
        });
    }
    return q;
}