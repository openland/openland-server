import { SDP } from './SDP';
import * as sdpTransform from 'sdp-transform';

export function writeSDP(src: SDP) {
    return sdpTransform.write(src);
}