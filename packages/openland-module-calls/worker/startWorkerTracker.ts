import { MediaKitchenService } from './../services/MediaKitchenService';
import { createNamedContext } from '@openland/context';
import { MediaKitchenRepository } from './../repositories/MediaKitchenRepository';
import { InvalidateSync } from '@openland/patterns';

export function startWorkerTracker(service: MediaKitchenService, repo: MediaKitchenRepository) {
    let ctx = createNamedContext('mediakitchen-worker-tracker');
    let invalidationSync = new InvalidateSync(async () => {
        await repo.onWorkersChanged(ctx, service.cluster.workers);
    });
    invalidationSync.invalidate();
    service.onWorkersChanged = () => {
        invalidationSync.invalidate();
    };
}