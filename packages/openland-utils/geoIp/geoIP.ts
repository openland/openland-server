import * as geoip from 'geoip-lite';

type LatLong = { long: number, lat: number };

export type GeoIPResponse = {
    ip: string,
    location_code: string,
    location_name: string,
    coordinates: LatLong | null
};

const deg2rad = (deg: number) => {
    return deg * Math.PI / 180;
};

export async function distanceBetween(cords1: LatLong, cords2: LatLong) {
    var R = 6371; // earth radius

    let lat1 = deg2rad(cords1.lat);
    let lat2 = deg2rad(cords2.lat);
    let latDelta = deg2rad(cords2.lat - cords1.lat);
    let longDelta = deg2rad(cords2.long - cords1.long);

    let a = Math.sin(latDelta / 2) * Math.sin(latDelta / 2)
        + Math.sin(longDelta / 2) * Math.sin(longDelta / 2) * Math.cos(lat1) * Math.cos(lat2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export async function geoIP(ip: string): Promise<GeoIPResponse> {
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
