import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { WorkQueue } from '../../openland-module-workers/WorkQueue';

export function createFirstWeekReportWorker() {
    const q = new WorkQueue<{ uid: number }, { result: string }>('first-week-user-report');
    if (serverRoleEnabled('workers')) {
        q.addWorker(async (item, rootCtx) => {
            return { result: 'completed' };
        });
    }
    return q;
}