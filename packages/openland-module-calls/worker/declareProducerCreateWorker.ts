import { MediaKitchenService } from '../kitchen/MediaKitchenService';
import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';
import { convertRtpParamsToStore } from 'openland-module-calls/kitchen/convert';

export function declareProducerCreateWorker(service: MediaKitchenService, repo: MediaKitchenRepository) {
    repo.producerCreateQueue.addWorkers(100, async (parent, args) => {
        const r = await inTx(parent, async (ctx) => {
            let pr = await Store.KitchenProducer.findById(ctx, args.id);
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
            return { router, ts, pr };
        });
        if (!r || r.pr.state !== 'creating') {
            return;
        }

        // Create Raw Producer
        let rawProducer = await service.getOrCreateProducer(
            r.router.workerId!,
            r.router.id,
            r.ts.id,
            r.pr.id,
            r.pr.parameters
        );

        // Commit state
        await inTx(parent, async (ctx) => {
            let pr = await Store.KitchenProducer.findById(ctx, args.id);
            if (!pr) {
                throw Error('Unable to find producer');
            }
            if (pr.state === 'creating') {
                pr.state = 'created';
                pr.rawId = rawProducer.id;
                pr.rtpParameters = convertRtpParamsToStore(rawProducer.rtpParameters);
                await pr.flush(ctx);
                await repo.onProducerCreated(ctx, pr.transportId, pr.id);
            }
        });
    });
}