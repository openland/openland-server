import { LatLong } from './geo';

export type GeoIPResponse = {
    ip: string,
    location_code: string,
    location_name: string,
    coordinates: LatLong | null
};

export function geoIP(ip: string): GeoIPResponse {
    let geoip = require('geoip-lite');
    let lookup = geoip.lookup(ip);
    if (!lookup) {
        return {
            ip: ip,
            location_name: 'Unknown',
            location_code: 'Unknown',
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
