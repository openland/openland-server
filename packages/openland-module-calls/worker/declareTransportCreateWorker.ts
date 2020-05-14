import { createLogger } from '@openland/log';
import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { MediaKitchenService } from '../kitchen/MediaKitchenService';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';

const logger = createLogger('mediakitchen');

export function declareTransportCreateWorker(service: MediaKitchenService, repo: MediaKitchenRepository) {
    repo.transportCreateQueue.addWorker(async (args, parent) => {

        logger.log(parent, 'Tryign to create transport: ' + args.id);

        let r = await inTx(parent, async (ctx) => {
            let ts = await Store.KitchenTransport.findById(ctx, args.id);
            if (!ts) {
                throw Error('Unable to find transport');
            }
            let router = await Store.KitchenRouter.findById(ctx, ts.routerId);
            if (!router) {
                throw Error('Unable to find router');
            }
            if (ts.state !== 'creating') {
                return { router, ts };
            }
            if (!router.workerId) {
                throw Error('Unable to find worker');
            }
            return { router, ts };
        });
        if (r.ts.state !== 'creating') {
            return { result: true };
        }

        // Create trans
        let tx = await service.getOrCreateTransport(r.router.workerId!, r.router.id, args.id);

        // Commit state
        await inTx(parent, async (ctx) => {
            let ts = await Store.KitchenTransport.findById(ctx, args.id);
            if (!ts) {
                throw Error('Unable to find transport');
            }
            if (ts.state === 'creating') {
                ts.state = 'created';
                ts.serverParameters = {
                    iceCandidates: tx.iceCandidates.map((v) => ({
                        type: v.type,
                        ip: v.ip,
                        foundation: v.foundation,
                        priority: v.priority,
                        protocol: v.protocol,
                        port: v.port
                    })),
                    iceParameters: {
                        usernameFragment: tx.iceParameters.usernameFragment,
                        password: tx.iceParameters.password
                    },
                    fingerprints: tx.dtlsParameters.fingerprints
                };
                await ts.flush(ctx);
                await repo.onTransportCreated(ctx, args.id);
            }
        });

        return { result: true };
    });
}