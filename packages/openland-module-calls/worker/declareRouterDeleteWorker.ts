import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';
import { MediaKitchenService } from '../kitchen/MediaKitchenService';

export function declareRouterDeleteWorker(service: MediaKitchenService, repo: MediaKitchenRepository) {
    repo.routerDeleteQueue.addWorker(async (args, parent) => {
        let router = await inTx(parent, async (ctx) => {
            let r = await Store.KitchenRouter.findById(ctx, args.id);
            if (!r) {
                throw Error('Unable to find router');
            }

            // Fast exit if no workers was assigned
            if (!r.workerId) {
                r.state = 'deleted';
            }
            return r;
        });
        if (router.state === 'deleted') {
            return { result: true };
        }

        // Doing "creating" with an existing retry key to get instance
        let rawRouter = await service.getOrCreateRouter(router.workerId!, router.id);
        if (rawRouter.closed) {
            return { result: true };
        }

        // Closing router
        await rawRouter.close();

        await inTx(parent, async (ctx) => {
            let r = await Store.KitchenRouter.findById(ctx, args.id);
            if (!r) {
                throw Error('Unable to find router');
            }
            if (r.state !== 'deleting') {
                return;
            }
            r.state = 'deleted';
            await repo.onRouterRemoved(ctx, r.id);
        });

        return { result: true };
    });
}