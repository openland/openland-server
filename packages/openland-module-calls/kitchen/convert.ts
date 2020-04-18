import { KitchenRtpParameters, KitchenRtpCapabilities } from './types';

function unwrap<T>(src: T | null | undefined): T | undefined {
    if (src !== undefined && src !== null) {
        return src;
    } else {
        return undefined;
    }
}

function wrap<T>(src: T | null | undefined): T | null {
    if (src !== undefined && src !== null) {
        return src;
    } else {
        return null;
    }
}

function unwrapMap(src: any | undefined | null): { [K in string]: string | boolean | number; } | undefined {
    if (!src) {
        return undefined;
    }
    let res: { [K in string]: string | boolean | number; } = {};
    for (let k of Object.keys(src)) {
        let v = src[k];
        if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') {
            res[k] = v;
        }
    }
    return res;
}

function wrapMap(src: any | undefined | null): { [K in string]: string | boolean | number; } | null {
    if (!src) {
        return null;
    }
    let res: { [K in string]: string | boolean | number; } = {};
    for (let k of Object.keys(src)) {
        let v = src[k];
        if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') {
            res[k] = v;
        }
    }
    return res;
}

export function convertRtpParamsToKitchen(params: KitchenRtpParameters) {
    return {
        mid: unwrap(params.mid),
        codecs: params.codecs.map((c) => ({
            mimeType: c.mimeType,
            payloadType: c.payloadType,
            clockRate: c.clockRate,
            channels: unwrap(c.channels),
            parameters: unwrapMap(c.parameters),
            rtcpFeedback: c.rtcpFeedback ? c.rtcpFeedback.map((f) => ({
                type: f.type,
                parameter: unwrap(f.parameter)
            })) : undefined
        })),
        headerExtensions: params.headerExtensions ? params.headerExtensions.map((h) => ({
            uri: h.uri,
            id: h.id,
            encrypt: unwrap(h.encrypt),
            parameters: unwrapMap(h.parameters)
        })) : undefined,
        encodings: params.encodings ? params.encodings.map((e) => ({
            ssrc: unwrap(e.ssrc),
            rid: unwrap(e.rid),
            codecPayloadType: unwrap(e.codecPayloadType),
            rtx: e.rtx ? { ssrc: e.rtx.ssrc } : undefined,
            dtx: unwrap(e.dtx),
            scalabilityMode: unwrap(e.scalabilityMode)
        })) : undefined,
        rtcp: params.rtcp ? {
            cname: unwrap(params.rtcp.cname),
            mux: unwrap(params.rtcp.mux),
            reducedSize: unwrap(params.rtcp.reducedSize),
        } : undefined
    };
}

export function convertRtpParamsToStore(params: KitchenRtpParameters) {
    return {
        mid: wrap(params.mid),
        codecs: params.codecs.map((c) => ({
            mimeType: c.mimeType,
            payloadType: c.payloadType,
            clockRate: c.clockRate,
            channels: wrap(c.channels),
            parameters: wrapMap(c.parameters),
            rtcpFeedback: c.rtcpFeedback ? c.rtcpFeedback.map((f) => ({
                type: f.type,
                parameter: wrap(f.parameter)
            })) : null
        })),
        headerExtensions: params.headerExtensions ? params.headerExtensions.map((h) => ({
            uri: h.uri,
            id: h.id,
            encrypt: wrap(h.encrypt),
            parameters: wrapMap(h.parameters)
        })) : null,
        encodings: params.encodings ? params.encodings.map((e) => ({
            ssrc: wrap(e.ssrc),
            rid: wrap(e.rid),
            codecPayloadType: wrap(e.codecPayloadType),
            rtx: e.rtx ? { ssrc: e.rtx.ssrc } : null,
            dtx: wrap(e.dtx),
            scalabilityMode: wrap(e.scalabilityMode)
        })) : null,
        rtcp: params.rtcp ? {
            cname: wrap(params.rtcp.cname),
            mux: wrap(params.rtcp.mux),
            reducedSize: wrap(params.rtcp.reducedSize),
        } : null
    };
}

export function convertRtpCapabilitiesToKitchen(params: KitchenRtpCapabilities) {
    return {
        codecs: params.codecs ? params.codecs.map((c) => ({
            kind: c.kind,
            mimeType: c.mimeType,
            preferredPayloadType: unwrap(c.preferredPayloadType),
            clockRate: c.clockRate,
            channels: unwrap(c.channels),
            parameters: unwrapMap(c.parameters),
            rtcpFeedback: c.rtcpFeedback ? c.rtcpFeedback.map((f) => ({
                type: f.type,
                parameter: unwrap(f.parameter)
            })) : undefined
        })) : undefined,
        headerExtensions: params.headerExtensions ? params.headerExtensions.map((h) => ({
            uri: h.uri,
            preferredId: h.preferredId,
            preferredEncrypt: unwrap(h.preferredEncrypt),
            direction: unwrap(h.direction),
            kind: unwrap(h.kind)
        })) : undefined,
        fecMechanisms: unwrap(params.fecMechanisms)
    };
}

export function convertRtpCapabilitiesToStore(params: KitchenRtpCapabilities) {
    return {
        codecs: params.codecs ? params.codecs.map((c) => ({
            kind: c.kind,
            mimeType: c.mimeType,
            preferredPayloadType: wrap(c.preferredPayloadType),
            clockRate: c.clockRate,
            channels: wrap(c.channels),
            parameters: wrapMap(c.parameters),
            rtcpFeedback: c.rtcpFeedback ? c.rtcpFeedback.map((f) => ({
                type: f.type,
                parameter: wrap(f.parameter)
            })) : null
        })) : null,
        headerExtensions: params.headerExtensions ? params.headerExtensions.map((h) => ({
            uri: h.uri,
            preferredId: h.preferredId,
            preferredEncrypt: wrap(h.preferredEncrypt),
            direction: wrap(h.direction),
            kind: wrap(h.kind)
        })) : null,
        fecMechanisms: wrap(params.fecMechanisms)
    };
}