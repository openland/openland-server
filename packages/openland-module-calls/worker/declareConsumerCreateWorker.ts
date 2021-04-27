import { MediaKitchenService } from '../kitchen/MediaKitchenService';
import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';
import { convertRtpParamsToStore } from 'openland-module-calls/kitchen/convert';

export function declareConsumerCreateWorker(service: MediaKitchenService, repo: MediaKitchenRepository) {
    repo.consumerCreateQueue.addWorkers(100, async (parent, args) => {
        const r = await inTx(parent, async (ctx) => {
            let cr = await Store.KitchenConsumer.findById(ctx, args.id);
            if (!cr) {
                return null;
            }
            let pr = await Store.KitchenProducer.findById(ctx, cr.producerId);
            if (!pr) {
                return null;
            }
            if (!pr.rawId) {
                return null;
            }
            let ts = await Store.KitchenTransport.findById(ctx, cr.transportId);
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
        if (!r || r.cr.state !== 'creating') {
            return;
        }

        // Create Raw Producer
        let rawConsumer = await service.getOrCreateConsumer(
            r.router.workerId!,
            r.router.id,
            r.cr.transportId,
            r.pr.rawId!,
            r.cr.id,
            r.cr.parameters
        );

        // Commit state
        await inTx(parent, async (ctx) => {
            let cr = await Store.KitchenConsumer.findById(ctx, args.id);
            if (!cr) {
                throw Error('Unable to find consumer');
            }
            if (cr.state === 'creating') {
                cr.state = 'created';
                cr.rtpParameters = convertRtpParamsToStore(rawConsumer.rtpParameters);
                await cr.flush(ctx);
                await repo.onConsumerCreated(ctx, r.cr.transportId, cr.id);
            }
        });
    });
}