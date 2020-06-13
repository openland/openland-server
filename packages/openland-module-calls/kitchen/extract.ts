import { KitchenIceCandidate } from './types';
import { MediaDescription, parseParams } from 'sdp-transform';
import { RtpParameters, RtpEncoding } from 'mediakitchen';

function extractParameters(src: string) {
    return parseParams(src);
}

export function convertParameters(src: any) {
    return Object.keys(src).map((key) => `${key}=${src[key]}`).join(';');
}

export function isSupportedHeaderExtension(extension: {
    uri: string;
}): boolean {
    // Not every browser support this extension
    if (extension.uri === 'urn:3gpp:video-orientation') {
        return false;
    }
    return true;
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

export function extractEncodings(src: MediaDescription) {

    //
    // Collect all ssrc
    //

    const ssrcs = new Set<number>();
    if (src.ssrcs) {
        for (const line of src.ssrcs) {
            const ssrc = Number(line.id);
            ssrcs.add(ssrc);
        }
    }
    if (ssrcs.size === 0) {
        throw new Error('no a=ssrc lines found');
    }

    //
    // Separate RTX encodings from plain one
    //
    const ssrcToRtxSsrc = new Map<number, number | null>();
    if (src.ssrcGroups) {
        for (const line of src.ssrcGroups) {
            if (line.semantics !== 'FID') {
                continue;
            }

            let [ssrcStr, rtxSsrcStr] = line.ssrcs.split(/\s+/);

            let ssrc = Number(ssrcStr);
            let rtxSsrc = Number(rtxSsrcStr);

            if (ssrcs.has(ssrc)) {
                // Remove both the SSRC and RTX SSRC from the set so later we know that they
                // are already handled.
                ssrcs.delete(ssrc);
                ssrcs.delete(rtxSsrc);
                // Add to the map.
                ssrcToRtxSsrc.set(ssrc, rtxSsrc);
            }
        }
    }

    //
    // Put plain encodings without RTX to the map
    //
    for (const ssrc of ssrcs) {
        ssrcToRtxSsrc.set(ssrc, null);
    }

    // Build result list
    const encodings: RtpEncoding[] = [];
    for (const [ssrc, rtxSsrc] of ssrcToRtxSsrc) {
        const encoding: RtpEncoding = { ssrc };
        if (rtxSsrc) {
            encoding.rtx = { ssrc: rtxSsrc };
        }
        encodings.push(encoding);
    }
    return encodings;
}

export function extractOpusRtpParameters(src: MediaDescription): RtpParameters {

    // Find codec
    const codec = src.rtp.find((v) => v.codec === 'opus');
    if (!codec) {
        throw Error('Unable to find opus codec!');
    }

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
        headerExtensions: (src.ext || [])
            .map((v) => ({
                uri: v.uri,
                id: v.value
            }))
            .filter((v) => isSupportedHeaderExtension(v)),
        codecs: [codecParameters],
        encodings: extractEncodings(src)
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

    // Resolve Param
    let params: any = {};
    let fmt = src.fmtp.find((v) => v.payload === codec.payload);
    if (fmt) {
        params = extractParameters(fmt.config);
    }

    // Create Codecs
    let codecs: RtpParameters['codecs'] = [];
    codecs.push({
        mimeType: 'video/H264',
        payloadType: codec.payload,
        clockRate: 90000,
        parameters: params,
        rtcpFeedback: (src.rtcpFb || [])
            .filter((v) => v.payload === codec.payload)
            .map((v) => ({ type: v.type, parameter: v.subtype }))
    });
    let rtx = src.rtp.find((v) => v.codec === 'rtx' && src.fmtp.find((f) => f.payload === v.payload && extractParameters(f.config).apt === codec.payload));
    if (rtx) {
        codecs.push({
            mimeType: 'video/rtx',
            payloadType: rtx.payload,
            clockRate: 90000,
            parameters: { apt: codec.payload }
        });
    }

    return {
        headerExtensions: (src.ext || [])
            .map((v) => ({
                uri: v.uri,
                id: v.value
            }))
            .filter((v) => isSupportedHeaderExtension(v)),
        codecs,
        encodings: extractEncodings(src)
    };
}

export function extractVP8RtpParameters(src: MediaDescription): RtpParameters {

    /// Find codec
    const codec = src.rtp.find((v) => v.codec === 'VP8');
    if (!codec) {
        throw Error('Unable to find opus codec!');
    }

    // Resolve Parameters
    let params: any = {};
    let fmt = src.fmtp.find((v) => v.payload === codec.payload);
    if (fmt) {
        params = extractParameters(fmt.config);
    }

    // Create Codecs
    let codecs: RtpParameters['codecs'] = [];
    codecs.push({
        mimeType: 'video/VP8',
        payloadType: codec.payload,
        clockRate: 90000,
        parameters: params,
        rtcpFeedback: (src.rtcpFb || [])
            .filter((v) => v.payload === codec.payload)
            .map((v) => ({ type: v.type, parameter: v.subtype }))
    });
    let rtx = src.rtp.find((v) => v.codec === 'rtx' && src.fmtp.find((f) => f.payload === v.payload && extractParameters(f.config).apt === codec.payload));
    if (rtx) {
        codecs.push({
            mimeType: 'video/rtx',
            payloadType: rtx.payload,
            clockRate: 90000,
            parameters: { apt: codec.payload }
        });
    }

    return {
        headerExtensions: (src.ext || [])
            .map((v) => ({
                uri: v.uri,
                id: v.value
            }))
            .filter((v) => isSupportedHeaderExtension(v)),
        codecs,
        encodings: extractEncodings(src)
    };
}