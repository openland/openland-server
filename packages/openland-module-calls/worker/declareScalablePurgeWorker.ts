import { CallRepository } from './../repositories/CallRepository';
import { inTx } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';

export function declareScalablePurgeWorker(repo: CallRepository) {
    repo.schedulerScalable.purgeWorker.addWorkers(10, async (parent, item) => {
        let task = await inTx(parent, async (ctx) => {

            //
            // Resolve worker and router
            //

            const workerId = await repo.schedulerScalable.mediator.repo.getSessionWorkerId(ctx, item.cid, item.sid);
            const routerId = await repo.schedulerScalable.mediator.repo.getSessionRouterId(ctx, item.cid, item.sid);
            if (!workerId) {
                return null;
            }
            if (!routerId) {
                return null;
            }

            //
            // Check if worker is active
            //

            let hasActive = false;
            let active = await Store.KitchenWorker.active.findAll(ctx);
            for (let a of active) {
                if (a.id === workerId) {
                    hasActive = true;
                    break;
                }
            }
            if (!hasActive) {
                return null;
            }

            return { workerId, routerId };
        });

        //
        // Close router if needed
        //

        if (task) {
            let router = await Modules.Calls.mediaKitchen.getOrCreateRouter(task.workerId, task.routerId);
            await router.close();
        }
    });
}