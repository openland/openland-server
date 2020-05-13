import { MediaKitchenService } from '../kitchen/MediaKitchenService';
import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';

export function declareRouterCreateWorker(service: MediaKitchenService, repo: MediaKitchenRepository) {
    repo.routerCreateQueue.addWorker(async (args, parent) => {

        // Assign Worker
        let router = await inTx(parent, async (ctx) => {
            let r = await Store.KitchenRouter.findById(ctx, args.id);
            if (!r) {
                throw Error('Unable to find router');
            }
            if (r.state !== 'creating') {
                return r;
            }
            if (!r.workerId) {
                r.workerId = await repo.pickWorker(ctx);
            }
            return r;
        });
        let workerId = router.workerId;
        if (router.state !== 'creating' || !workerId) {
            return;
        }

        // Create Raw Router
        await service.getOrCreateRouter(workerId, args.id);

        // Assign Raw Router
        await inTx(parent, async (ctx) => {
            let r = await Store.KitchenRouter.findById(ctx, args.id);
            if (!r) {
                throw Error('Unable to find router');
            }
            if (r.state === 'creating') {
                r.state = 'created';
                await r.flush(ctx);
                await repo.onRouterCreated(ctx, args.id);
            }
        });
    });
}