import { createLogger } from '@openland/log';
import { MediaKitchenService } from '../kitchen/MediaKitchenService';
import { createNamedContext } from '@openland/context';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';
import { InvalidateSync } from '@openland/patterns';

const logger = createLogger('mediakitchen');

export function startWorkerTracker(service: MediaKitchenService, repo: MediaKitchenRepository) {
    let ctx = createNamedContext('mediakitchen-worker-tracker');
    let invalidationSync = new InvalidateSync(async () => {
        try {
            await repo.onWorkersChanged(ctx, service.cluster.workers);
        } catch (e) {
            logger.warn(ctx, e);
            throw e;
        }
    });
    invalidationSync.invalidate();
    service.onWorkersChanged = () => {
        invalidationSync.invalidate();
    };
}