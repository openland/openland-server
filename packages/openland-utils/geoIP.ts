import { LatLong } from './geo';
import * as geoip from 'geoip-lite';

export type GeoIPResponse = {
    ip: string,
    location_code: string,
    location_name: string,
    coordinates: LatLong | null
};

export function geoIP(ip: string): GeoIPResponse {
    let lookup = geoip.lookup(ip);
    if (!lookup) {
        return {
            ip: ip,
            location_name: '_',
            location_code: '_',
            coordinates: null
        };
    }
    return {
        ip: ip,
        location_name: lookup.city,
        location_code: lookup.country,
        coordinates: {
            lat: lookup.ll[0],
            long: lookup.ll[1]
        }
    };
}
