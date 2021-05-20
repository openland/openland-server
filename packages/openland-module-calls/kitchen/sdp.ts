import { KitchenRtpCapabilities } from './../kitchen/types';
import { KitchenRtpParameters, KitchenIceCandidate } from '../kitchen/types';
import { writeSDP } from 'openland-module-calls/sdp/writeSDP';
import { SDP } from '../sdp/SDP';
import { Capabilities } from '../repositories/CallScheduler';
import { convertParameters, convertIceCandidate, isSupportedHeaderExtension } from 'openland-module-calls/kitchen/extract';
import { MediaDescription } from 'sdp-transform';

export function getAudioRtpCapabilities(src: Capabilities): KitchenRtpCapabilities {
    let codec = src.codecs.find((v) => v.mimeType === 'audio/opus');
    if (!codec) {
        throw Error('Unable to find OPUS codec');
    }

    let res: KitchenRtpCapabilities = {
        codecs: [{
            kind: 'audio',
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
            parameters: {
                stereo: 1,
                maxplaybackrate: 48000,
                useinbandfec: 1
            },
            rtcpFeedback: codec.rtcpFeedback.map((f) => ({ type: f.type, parameter: f.value }))
        }],
        headerExtensions: src.headerExtensions
            .filter((v) => v.kind === 'audio')
            .filter((v) => isSupportedHeaderExtension(v))
            .map((h) => ({
                uri: h.uri,
                preferredId: h.preferredId,
                kind: 'audio'
            }))
    };

    return res;
}

export function getVideoCapabilities(src: Capabilities): KitchenRtpCapabilities {

    let codecs: KitchenRtpCapabilities['codecs'] = [];

    let h264codec = src.codecs.find((v) =>
        v.mimeType === 'video/H264'
        && v.parameters.some((p) => p.key === 'profile-level-id' && (p.value === '42e034' || p.value === '42e01f'))
        && v.parameters.some((p) => p.key === 'packetization-mode' && p.value === '1')
    );
    if (h264codec) {
        codecs.push({
            kind: 'audio',
            mimeType: 'video/H264',
            clockRate: 90000,
            parameters: {
                'packetization-mode': 1,
                'profile-level-id': '42e01f',
                'level-asymmetry-allowed': 1,
            },
            rtcpFeedback: h264codec.rtcpFeedback.map((f) => ({ type: f.type, parameter: f.value }))
        });
    }

    let vp8codec = src.codecs.find((v) =>
        v.mimeType === 'video/VP8'
    );
    if (vp8codec) {
        codecs.push({
            kind: 'audio',
            mimeType: 'video/VP8',
            clockRate: 90000,
            parameters: {},
            rtcpFeedback: vp8codec.rtcpFeedback.map((f) => ({ type: f.type, parameter: f.value }))
        });
    }

    let res: KitchenRtpCapabilities = {
        codecs,
        headerExtensions: src.headerExtensions
            .filter((v) => v.kind === 'video')
            .filter((v) => isSupportedHeaderExtension(v))
            .map((h) => ({
                uri: h.uri,
                preferredId: h.preferredId,
                kind: 'video'
            }))
    };
    return res;
}

export function generateSDP(
    fingerprints: { algorithm: string, value: string }[],
    iceParameters: { usernameFragment: string, password: string },
    media: Array<{
        type: string;
        port: number;
        protocol: string;
        payloads?: string;
    } & MediaDescription>
) {
    let answer: SDP = {

        // Boilerplate
        version: 0,
        origin: {
            username: '-',
            sessionId: '10000',
            sessionVersion: 1,
            netType: 'IN',
            ipVer: 4,
            address: '0.0.0.0'
        } as any,
        name: '-',
        timing: { start: 0, stop: 0 },

        // ICE
        fingerprint: {
            type: fingerprints[fingerprints.length - 1].algorithm,
            hash: fingerprints[fingerprints.length - 1].value
        },
        icelite: 'ice-lite',
        iceUfrag: iceParameters.usernameFragment,
        icePwd: iceParameters.password,

        // Media
        msidSemantic: { semantic: 'WMS', token: '*' },
        groups: media.length > 0 ? [{ type: 'BUNDLE', mids: media.map((v) => v.mid!).join(' ') }] : undefined,
        media: media
    };
    return writeSDP(answer);
}

export function createMediaDescription(
    mid: string,
    type: 'video' | 'audio',
    port: number,
    direction: 'recvonly' | 'sendonly',
    active: boolean,
    rtpParameters: KitchenRtpParameters,
    iceCandidates: KitchenIceCandidate[],
): {
    type: string;
    port: number;
    protocol: string;
    payloads?: string;
} & MediaDescription {
    let rtcpFb: MediaDescription['rtcpFb'] = [];
    for (let c of rtpParameters.codecs) {
        if (c.rtcpFeedback) {
            for (let v of c.rtcpFeedback) {
                rtcpFb.push({
                    payload: c.payloadType,
                    type: v.type,
                    subtype: v.parameter ? v.parameter : undefined
                });
            }
        }
    }
    return {
        mid,
        type,
        protocol: 'UDP/TLS/RTP/SAVPF',
        payloads: rtpParameters.codecs.map((v) => v.payloadType.toString()).join(' '),
        port,
        rtcpMux: 'rtcp-mux',
        rtcpRsize: 'rtcp-rsize',
        direction: active ? direction : 'inactive',
        ext: (rtpParameters.headerExtensions || []).map((v) => ({
            value: v.id,
            uri: v.uri
        })),

        // Codec
        rtp: rtpParameters.codecs.map((v) => ({
            codec: v.mimeType.substring(6),
            payload: v.payloadType,
            rate: v.clockRate,
            encoding: v.channels ? v.channels : undefined,
        })),
        fmtp: rtpParameters.codecs.filter((v) => !!v.parameters && Object.keys(v.parameters).length > 0).map((v) => ({
            payload: v.payloadType,
            config: convertParameters(v.parameters!)
        })),
        rtcpFb,

        // ICE + DTLS
        setup: direction === 'sendonly' ? 'actpass' : 'active',
        connection: { ip: '0.0.0.0', version: 4 },
        candidates: iceCandidates.map((v) => convertIceCandidate(v)),
        endOfCandidates: 'end-of-candidates',
        ...{ iceOptions: 'renomination' },

        // SSRC
        ssrcs: [{ id: rtpParameters.encodings![0].ssrc!, attribute: 'cname', value: rtpParameters.rtcp!.cname! }]
    };
}
