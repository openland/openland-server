import { inTx } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';
import { MediaKitchenService } from '../kitchen/MediaKitchenService';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';

export function declareTransportDeleteWorker(service: MediaKitchenService, repo: MediaKitchenRepository) {
    repo.transportDeleteQueue.addWorkers(100, async (parent, args) => {
        let r = await inTx(parent, async (ctx) => {
            let ts = await Store.KitchenTransport.findById(ctx, args.id);
            if (!ts) {
                return null;
            }
            let router = await Store.KitchenRouter.findById(ctx, ts.routerId);
            if (!router) {
                return null;
            }
            if (!router.workerId) {
                return null;
            }
            return { router, ts };
        });
        if (!r || r.ts.state === 'deleted') {
            return;
        }

        // Close Router
        let rawTransport = await service.getOrCreateTransport(r.router.workerId!, r.router.id, r.ts.id);
        if (rawTransport.closed) {
            return;
        }
        await rawTransport.close();

        // Commit
        await inTx(parent, async (ctx) => {
            let ts = await Store.KitchenTransport.findById(ctx, args.id);
            if (!ts) {
                throw Error('Unable to find transport');
            }
            let router = await Store.KitchenRouter.findById(ctx, ts.routerId);
            if (!router) {
                throw Error('Unable to find router');
            }
            if (ts.state !== 'deleting') {
                return;
            }
            ts.state = 'deleted';
            await repo.onTransportRemoved(ctx, ts.id);
        });
    });
}