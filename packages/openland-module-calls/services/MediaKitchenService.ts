import { createLogger } from '@openland/log';
import { Cluster } from 'mediakitchen';
import { createNamedContext } from '@openland/context';

const logger = createLogger('mediakitchen');

export class MediaKitchenService {
    readonly cluster: Cluster;

    constructor(cluster: Cluster) {
        this.cluster = cluster;
        const ctx = createNamedContext('mediakitchen');
        for (let w of this.cluster.workers) {
            logger.log(ctx, 'Worker: ' + w.id + ': ' + w.status);
        }
        this.cluster.onWorkerStatusChanged = (w) => {
            logger.log(ctx, 'Worker: ' + w.id + ': ' + w.status);
        };
    }
}