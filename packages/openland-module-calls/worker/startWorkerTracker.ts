import { MediaKitchenService } from '../kitchen/MediaKitchenService';
import { createNamedContext } from '@openland/context';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';
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