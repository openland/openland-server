import { KitchenIceCandidate } from './types';
import { MediaDescription, parseParams } from 'sdp-transform';
import { RtpParameters } from 'mediakitchen';

function extractParameters(src: string) {
    return parseParams(src);
}

export function convertParameters(src: any) {
    return Object.keys(src).map((key) => `${key}=${src[key]}`).join(';');
}

export function convertIceCandidate(src: KitchenIceCandidate) {
    let res: {
        foundation: string;
        component: number;
        transport: string;
        priority: number | string;
        ip: string;
        port: number;
        type: string;
        tcpType?: string;
    } = {
        component: 1, // Always 1
        foundation: src.foundation,
        ip: src.ip,
        port: src.port,
        priority: src.priority,
        transport: src.protocol,
        type: 'host'
    };

    if (src.protocol === 'tcp') {
        res.tcpType = 'passive';
    }

    return res;
}

export function extractOpusRtpParameters(src: MediaDescription): RtpParameters {

    // Find codec
    const codec = src.rtp.find((v) => v.codec === 'opus');
    if (!codec) {
        throw Error('Unable to find opus codec!');
    }

    // Find ssrc
    let ssrc = src.ssrcs![0].id as number;

    // Resolve Parameters
    let params: any = {};
    let fmt = src.fmtp.find((v) => v.payload === codec.payload);
    if (fmt) {
        params = extractParameters(fmt.config);
    }

    // Create Producer
    let codecParameters = {
        mimeType: 'audio/opus',
        payloadType: codec.payload,
        clockRate: 48000,
        channels: 2,
        parameters: params,
        rtcpFeedback: (src.rtcpFb || [])
            .filter((v) => v.payload === codec.payload)
            .map((v) => ({ type: v.type, parameter: v.subtype }))
    };

    return {
        headerExtensions: (src.ext || []).map((v) => ({
            uri: v.uri,
            id: v.value
        })),
        codecs: [codecParameters],
        encodings: [{ ssrc: ssrc }]
    };
}

export function extractH264RtpParameters(src: MediaDescription): RtpParameters {

    // Resolving a codec
    let codecPayload: number | null = null;
    for (let c of src.rtp) {
        if (c.codec !== 'H264') {
            continue;
        }
        let fmt2 = src.fmtp.find((f) => f.payload === c.payload);
        if (!fmt2) {
            continue;
        }
        let cfg = extractParameters(fmt2.config);
        if (cfg['packetization-mode'] !== 1) {
            continue;
        }
        if (cfg['profile-level-id'] !== '42e034' && cfg['profile-level-id'] !== '42e01f') {
            continue;
        }
        codecPayload = c.payload;
        break;
    }
    if (codecPayload === null) {
        throw Error('Unable to find vide codec');
    }
    let codec = src.rtp.find((v) => v.payload === codecPayload)!;
    if (!codec) {
        throw Error('Unable to find codec!');
    }

    // Find ssrc
    let ssrc = src.ssrcs![0].id as number;

    // Resolve Param
    let params: any = {};
    let fmt = src.fmtp.find((v) => v.payload === codec.payload);
    if (fmt) {
        params = extractParameters(fmt.config);
    }

    // Create Producer
    let codecParameters = {
        mimeType: 'video/H264',
        payloadType: codec.payload,
        clockRate: 90000,
        parameters: params,
        rtcpFeedback: (src.rtcpFb || [])
            .filter((v) => v.payload === codec.payload)
            .map((v) => ({ type: v.type, parameter: v.subtype }))
    };

    return {
        headerExtensions: (src.ext || []).map((v) => ({
            uri: v.uri,
            id: v.value
        })),
        codecs: [codecParameters],
        encodings: [{ ssrc: ssrc }]
    };
}

export function extractVP8RtpParameters(src: MediaDescription): RtpParameters {

    /// Find codec
    const codec = src.rtp.find((v) => v.codec === 'VP8');
    if (!codec) {
        throw Error('Unable to find opus codec!');
    }

    // Find ssrc
    let ssrc = src.ssrcs![0].id as number;

    // Resolve Parameters
    let params: any = {};
    let fmt = src.fmtp.find((v) => v.payload === codec.payload);
    if (fmt) {
        params = extractParameters(fmt.config);
    }

    // Create Producer
    let codecParameters = {
        mimeType: 'video/VP8',
        payloadType: codec.payload,
        clockRate: 90000,
        parameters: params,
        rtcpFeedback: (src.rtcpFb || [])
            .filter((v) => v.payload === codec.payload)
            .map((v) => ({ type: v.type, parameter: v.subtype }))
    };

    return {
        headerExtensions: (src.ext || []).map((v) => ({
            uri: v.uri,
            id: v.value
        })),
        codecs: [codecParameters],
        encodings: [{ ssrc: ssrc }]
    };
}