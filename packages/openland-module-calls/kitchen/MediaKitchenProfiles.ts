import { Config } from 'openland-config/Config';
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
    rtcpFeedback: [{
        type: 'goog-remb'
    }, {
        type: 'transport-cc'
    }, {
        type: 'ccm',
        parameter: 'fir'
    }, {
        type: 'nack'
    }, {
        type: 'nack',
        parameter: 'pli'
    }]
}, {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {},
    rtcpFeedback: [{
        type: 'goog-remb'
    }, {
        type: 'transport-cc'
    }, {
        type: 'ccm',
        parameter: 'fir'
    }, {
        type: 'nack'
    }, {
        type: 'nack',
        parameter: 'pli'
    }]
}];

export const TRANSPORT_PARAMETERS = {
    enableTcp: true,
    preferTcp: false,
    enableUdp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 6000000 /* 750kb/s */
};

export const ICE_TRANSPORT_POLICY: 'none' | 'all' | 'relay' = Config.environment === 'production' ? 'relay' : 'all';