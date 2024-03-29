import { createLogger } from '@openland/log';
import { MediaKitchenService } from '../kitchen/MediaKitchenService';
import { createNamedContext } from '@openland/context';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';
import { InvalidateSync } from '@openland/patterns';
import { createTracer } from 'openland-log/createTracer';

const logger = createLogger('mediakitchen');
const tracer = createTracer('calls');

export function startWorkerTracker(service: MediaKitchenService, repo: MediaKitchenRepository) {
    let ctx = createNamedContext('mediakitchen-worker-tracker');

    let healthyWorkers = new Set<string>();

    let invalidationSync = new InvalidateSync(async () => {
        for (let w of service.cluster.workers) {
            if (w.status === 'healthy') {
                if (healthyWorkers.has(w.id)) {
                    continue;
                } else {
                    healthyWorkers.add(w.id);
                    logger.log(ctx, 'Found healthy worker: ' + w.id);
                }
            } else {
                if (!healthyWorkers.has(w.id)) {
                    continue;
                } else {
                    healthyWorkers.delete(w.id);
                    logger.log(ctx, 'Worker became unhealthy: ' + w.id);
                }
            }
        }
        try {
            await tracer.trace(ctx, 'workers-changed', (c) => repo.onWorkersChanged(c, service.cluster.workers));
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