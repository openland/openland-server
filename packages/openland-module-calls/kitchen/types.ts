import { SimpleMap } from 'mediakitchen';

export interface KitchenIceCandidate {
    foundation: string;
    priority: number;
    ip: string;
    protocol: 'tcp' | 'udp';
    port: number;
}

export interface KitchenRtpParameters {
    mid?: string | null | undefined;
    codecs: {
        mimeType: string;
        payloadType: number;
        clockRate: number;
        channels?: number | null | undefined;
        parameters?: SimpleMap | null | undefined;
        rtcpFeedback?: {
            type: string;
            parameter?: string | null | undefined;
        }[] | null | undefined;
    }[];
    headerExtensions?: {
        uri: string;
        id: number;
        encrypt?: boolean | null | undefined;
        parameters?: SimpleMap | null | undefined;
    }[] | null | undefined;
    encodings?: {
        ssrc?: number | null | undefined;
        rid?: string | null | undefined;
        codecPayloadType?: number | null | undefined;
        rtx?: { ssrc: number } | null | undefined;
        dtx?: boolean | null | undefined;
        scalabilityMode?: string | null | undefined;
    }[] | null | undefined;
    rtcp?: {
        cname?: string | null | undefined;
        reducedSize?: boolean | null | undefined;
        mux?: boolean | null | undefined;
    } | null | undefined;
}

export interface KitchenProducerParams {
    kind: 'audio' | 'video';
    rtpParameters: KitchenRtpParameters;
    keyFrameRequestDelay?: number | undefined | null;
    paused?: boolean | null | undefined;
}

export interface KitchenRtpCapabilities {
    codecs?: {
        kind: 'audio' | 'video';
        mimeType: string;
        clockRate: number;
        channels?: number | null | undefined;
        parameters?: SimpleMap | null | undefined;
        rtcpFeedback?: {
            type: string;
            parameter?: string | null | undefined;
        }[] | null | undefined;
        preferredPayloadType?: number | null | undefined;
    }[] | null | undefined;
    headerExtensions?: {
        uri: string;
        preferredId: number;
        kind?: '' | 'audio' | 'video' | undefined | null;
        preferredEncrypt?: boolean | null | undefined;
        direction?: 'sendrecv' | 'sendonly' | 'recvonly' | 'inactive' | null | undefined;
    }[] | null | undefined;
    fecMechanisms?: string[] | null | undefined;
}

export interface KitchenConsumerParams {
    rtpCapabilities?: KitchenRtpCapabilities | null | undefined;
    paused?: boolean | null | undefined;
    preferredLayers?: { spatialLayer: number, temporalLayer: number | null | undefined } | null | undefined;
}