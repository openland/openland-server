import { Store } from './../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { MediaKitchenService } from '../services/MediaKitchenService';
import { MediaKitchenRepository } from '../repositories/MediaKitchenRepository';

export function declareTransportConnectWorker(service: MediaKitchenService, repo: MediaKitchenRepository) {
    repo.transportConnectQueue.addWorker(async (args, parent) => {
        let r = await inTx(parent, async (ctx) => {
            let ts = await Store.KitchenTransport.findById(ctx, args.id);
            if (!ts) {
                throw Error('Unable to find transport');
            }
            let router = await Store.KitchenRouter.findById(ctx, ts.routerId);
            if (!router) {
                throw Error('Unable to find router');
            }
            if (!router.workerId) {
                throw Error('Unable to find worker');
            }
            return { router, ts };
        });
        if (r.ts.state !== 'connecting') {
            return { result: true };
        }

        // Connect
        let rawTransport = await service.getOrCreateTransport(r.router.workerId!, r.router.id, r.ts.id);
        await rawTransport.connect({
            dtlsParameters: {
                fingerprints: r.ts.clientParameters!.fingerprints
            }
        });

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
            if (ts.state !== 'connecting') {
                return;
            }
            ts.state = 'connected';
            // TODO: Notify
        });

        return { result: true };
    });
}