import { Modules } from '../../openland-modules/Modules';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { WorkQueue } from '../../openland-module-workers/WorkQueue';

export function createSilentUserReportWorker() {
    const q = new WorkQueue<{ uid: number }, { result: string }>('silent-user-report');
    if (serverRoleEnabled('workers')) {
        q.addWorker(  async (item, ctx) => {
            return { result: 'completed' };

            const { uid } = item;
            await Modules.Stats.generateSilentUserReport(ctx, uid);
            return { result: 'completed' };
        });
    }
    return q;
}