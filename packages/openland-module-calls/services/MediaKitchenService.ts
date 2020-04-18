import { Cluster } from 'mediakitchen';

export class MediaKitchenService {
    readonly cluster: Cluster;

    onWorkersChanged?: () => void;

    constructor(cluster: Cluster) {
        this.cluster = cluster;
        // const ctx = createNamedContext('mediakitchen');
        // for (let w of this.cluster.workers) {
        //     // logger.log(ctx, 'Worker: ' + w.id + ': ' + w.status);
        // }
        this.cluster.onWorkerStatusChanged = (w) => {
            // logger.log(ctx, 'Worker: ' + w.id + ': ' + w.status);
            if (this.onWorkersChanged) {
                this.onWorkersChanged();
            }
        };
    }

    private async createRouter(workerId: string, retryKey: string) {
        let worker = this.cluster.workers.find((v) => v.id === workerId);
        if (!worker) {
            throw Error('Unable to find assigned worker');
        }
        let rawRouter = await worker.createRouter({
            mediaCodecs: [{
                kind: 'audio',
                mimeType: 'audio/opus',
                clockRate: 48000,
                channels: 2,
                rtcpFeedback: [
                    { type: 'transport-cc' }
                ]
            }]
        }, retryKey);
        return rawRouter;
    }

    async getOrCreateRouter(workerId: string, id: string) {
        return await this.createRouter(workerId, id);
    }

    async getOrCreateTransport(workerId: string, routerId: string, transportId: string) {
        let router = await this.getOrCreateRouter(workerId, routerId);
        return await router.createWebRtcTransport({
            enableUdp: true,
            enableTcp: true,
            preferTcp: true,
            preferUdp: true,
        }, transportId);
    }
}