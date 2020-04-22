import { RtpCodecCapability } from 'mediakitchen';

export const ROUTER_CODECS: RtpCodecCapability[] = [{
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
    rtcpFeedback: [
        { type: 'transport-cc' }
    ]
}, {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
        'packetization-mode': 1,
        'profile-level-id': '42e01f',
        'level-asymmetry-allowed': 1,
    },
}];

export const TRANSPORT_PARAMETERS = {
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    preferTcp: false,
};