import { MediaKitchenService } from '../kitchen/MediaKitchenService';
import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';

export function declareConsumerDeleteWorker(service: MediaKitchenService, repo: MediaKitchenRepository) {
    repo.consumerDeleteQueue.addWorker(async (args, parent) => {
        let r = await inTx(parent, async (ctx) => {
            let cr = await Store.KitchenConsumer.findById(ctx, args.id);
            if (!cr) {
                throw Error('Unable to find consumer');
            }
            let pr = await Store.KitchenProducer.findById(ctx, cr.producerId);
            if (!pr) {
                throw Error('Unable to find producer');
            }
            let ts = await Store.KitchenTransport.findById(ctx, pr.transportId);
            if (!ts) {
                throw Error('Unable to find transport');
            }
            let router = await Store.KitchenRouter.findById(ctx, pr.routerId);
            if (!router) {
                throw Error('Unable to find router');
            }
            if (!router.workerId) {
                throw Error('Unable to find worker');
            }
            return { router, ts, pr, cr };
        });

        if (r.pr.state !== 'deleted') {
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
        await rawConsumer.close();

        // Commit
        await inTx(parent, async (ctx) => {
            let pr = await Store.KitchenConsumer.findById(ctx, args.id);
            if (!pr) {
                throw Error('Unable to find consumer');
            }
            if (pr.state !== 'deleting') {
                return;
            }
            pr.state = 'deleted';
            await repo.onConsumerRemoved(ctx, pr.id);
        });
    });
}