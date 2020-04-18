import { RtpCodecCapability } from 'mediakitchen';

export const ROUTER_CODECS: RtpCodecCapability[] = [{
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
    rtcpFeedback: [
        { type: 'transport-cc' }
    ]
}];

export const TRANSPORT_PARAMETERS = {
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    preferTcp: false,
};