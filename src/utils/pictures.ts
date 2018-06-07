import { CallContext } from '../api/utils/CallContext';
import { STREET_VIEW_KEY } from '../keys';

export function resolvePicture(src?: string, width?: number, height?: number) {
    if (src) {
        return {
            id: src,
            width: width,
            height: height
        };
    } else {
        return null;
    }
}

export function resolveRawPicture(url: string, retina: string) {
    return {
        url: url,
        retina: retina
    };
}

export function resolveStreetView(context: CallContext, address: string, height: number, width: number) {
    let location = encodeURIComponent(address + ' San Francisco, CA, USA'); // 40.720032,-73.988354
    return resolveRawPicture(
        `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${location}&fov=90&key=${STREET_VIEW_KEY}`,
        `https://maps.googleapis.com/maps/api/streetview?size=${width * 2}x${height * 2}&location=${location}&fov=90&key=${STREET_VIEW_KEY}`
    );
}