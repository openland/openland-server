import { Modules } from '../../openland-modules/Modules';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { WorkQueue } from '../../openland-module-workers/WorkQueue';
import { DelayedQueue } from '../../openland-module-workers/DelayedQueue';

export function createSilentUserReportWorker() {
    const q = new WorkQueue<{ uid: number }, { result: string }>('silent-user-report');
    const obsoleteQueue = new DelayedQueue<{ uid: number }, { result: string }>('silent-user-report');
    if (serverRoleEnabled('workers')) {
        q.addWorker(  async (item, ctx) => {
            const { uid } = item;
            await Modules.Stats.generateSilentUserReport(ctx, uid);
            return { result: 'completed' };
        });

        obsoleteQueue.start(async (item, ctx) => {
            const { uid } = item;
            await Modules.Stats.generateSilentUserReport(ctx, uid);
            return { result: 'completed' };
        });
    }
    return q;
}