import { MediaKitchenService } from '../kitchen/MediaKitchenService';
import { Store } from 'openland-module-db/FDB';
import { inReadOnlyTx } from '@openland/foundationdb';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';

export function declareConsumerUnpauseWorker(service: MediaKitchenService, repo: MediaKitchenRepository) {
    repo.consumerUnpauseQueue.addWorkers(100, async (parent, args) => {
        let r = await inReadOnlyTx(parent, async (ctx) => {
            let cr = await Store.KitchenConsumer.findById(ctx, args.id);
            if (!cr) {
                return null;
            }
            let pr = await Store.KitchenProducer.findById(ctx, cr.producerId);
            if (!pr) {
                return null;
            }
            let ts = await Store.KitchenTransport.findById(ctx, pr.transportId);
            if (!ts) {
                return null;
            }
            let router = await Store.KitchenRouter.findById(ctx, pr.routerId);
            if (!router) {
                return null;
            }
            if (!router.workerId) {
                return null;
            }
            return { router, ts, pr, cr };
        });

        if (!r || r.pr.state === 'deleted' || r.pr.state === 'deleting') {
            return;
        }

        // Destroy producer
        let rawConsumer = await service.getOrCreateConsumer(
            r.router.workerId!,
            r.router.id,
            r.ts.id,
            r.pr.id,
            r.cr.id,
            r.cr.parameters
        );
        await rawConsumer.resume();
    });
}