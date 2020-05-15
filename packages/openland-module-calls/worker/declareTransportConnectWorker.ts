import { Store } from './../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { MediaKitchenService } from '../kitchen/MediaKitchenService';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';

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
            return;
        }

        // Connect
        let rawTransport = await service.getOrCreateTransport(r.router.workerId!, r.router.id, r.ts.id);
        await rawTransport.connect({
            dtlsParameters: {
                role: r.ts.clientParameters!.dtlsRole ? r.ts.clientParameters!.dtlsRole : undefined,
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
            await ts.flush(ctx);
            await repo.onTransportConnected(ctx, ts.id);
        });
    });
}