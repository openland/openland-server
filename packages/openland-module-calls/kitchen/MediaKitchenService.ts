import { KitchenProducerParams, KitchenConsumerParams } from './types';
import { ROUTER_CODECS, TRANSPORT_PARAMETERS } from './MediaKitchenProfiles';
import { Cluster } from 'mediakitchen';
import { convertRtpParamsToKitchen, convertRtpCapabilitiesToKitchen } from './convert';

function unwrap<T>(src: T | null | undefined): T | undefined {
    if (src !== undefined && src !== null) {
        return src;
    } else {
        return undefined;
    }
}

export class MediaKitchenService {
    readonly cluster: Cluster;

    onWorkersChanged?: () => void;

    constructor(cluster: Cluster) {
        this.cluster = cluster;
        this.cluster.onWorkerStatusChanged = () => {
            if (this.onWorkersChanged) {
                this.onWorkersChanged();
            }
        };
    }

    async getOrCreateRouter(workerId: string, id: string) {
        let worker = this.cluster.workers.find((v) => v.id === workerId);
        if (!worker) {
            throw Error('Unable to find assigned worker');
        }
        let rawRouter = await worker.createRouter({ mediaCodecs: ROUTER_CODECS }, id);
        return rawRouter;
    }

    async getOrCreateTransport(workerId: string, routerId: string, transportId: string) {
        let router = await this.getOrCreateRouter(workerId, routerId);
        return await router.createWebRtcTransport(TRANSPORT_PARAMETERS, transportId);
    }

    async getOrCreateProducer(workerId: string, routerId: string, transportId: string, producerId: string, parameters: KitchenProducerParams) {
        let transport = await this.getOrCreateTransport(workerId, routerId, transportId);
        return await transport.produce({
            kind: parameters.kind,
            rtpParameters: convertRtpParamsToKitchen(parameters.rtpParameters),
            keyFrameRequestDelay: unwrap(parameters.keyFrameRequestDelay),
            paused: unwrap(parameters.paused)
        }, producerId);
    }

    async getOrCreateConsumer(workerId: string, routerId: string, transportId: string, producerId: string, consumerId: string, parameters: KitchenConsumerParams) {
        let transport = await this.getOrCreateTransport(workerId, routerId, transportId);
        return await transport.consume(producerId, {
            rtpCapabilities: parameters.rtpCapabilities ? convertRtpCapabilitiesToKitchen(parameters.rtpCapabilities) : undefined,
            preferredLayers: parameters.preferredLayers ? {
                spatialLayer: parameters.preferredLayers.spatialLayer,
                temporalLayer: unwrap(parameters.preferredLayers.temporalLayer)
            } : undefined,
            paused: unwrap(parameters.paused),
        }, consumerId);
    }
}