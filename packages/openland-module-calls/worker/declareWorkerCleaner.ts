import { MediaKitchenService } from '../kitchen/MediaKitchenService';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';

export function declareWorkerCleanerWorker(service: MediaKitchenService, repo: MediaKitchenRepository) {
    repo.workerDeleteQueue.addWorkers(1, async (parent, args) => {
        await repo.doWorkerCleanup(parent, args.id);
    });
}