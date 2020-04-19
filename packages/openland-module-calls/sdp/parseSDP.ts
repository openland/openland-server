import * as sdpTransform from 'sdp-transform';

export function parseSDP(src: string) {
    return sdpTransform.parse(src);
}