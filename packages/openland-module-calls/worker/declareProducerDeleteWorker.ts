import { MediaKitchenService } from '../kitchen/MediaKitchenService';
import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';

export function declareProducerDeleteWorker(service: MediaKitchenService, repo: MediaKitchenRepository) {
    repo.producerDeleteQueue.addWorker(async (args, parent) => {
        let r = await inTx(parent, async (ctx) => {
            let pr = await Store.KitchenProducer.findById(ctx, args.id);
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
            return { router, ts, pr };
        });

        if (r.pr.state !== 'deleted') {
            return { result: true };
        }

        // Destroy producer
        let rawProducer = await service.getOrCreateProducer(
            r.router.workerId!,
            r.router.id,
            r.ts.id,
            r.pr.id,
            r.pr.parameters
        );
        await rawProducer.close();

        // Commit
        await inTx(parent, async (ctx) => {
            let pr = await Store.KitchenProducer.findById(ctx, args.id);
            if (!pr) {
                throw Error('Unable to find producer');
            }
            if (pr.state !== 'deleting') {
                return;
            }
            pr.state = 'deleted';
            await repo.onProducerRemoved(ctx, pr.transportId, pr.id);
        });

        return { result: true };
    });
}