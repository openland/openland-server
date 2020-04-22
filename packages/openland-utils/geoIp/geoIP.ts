import * as geoip from 'geoip-lite';

export type GeoIPResponse = {
    location_code: string,
    location_name: string,
    coordinates: { long: number, lat: number } | null
};

const deg2rad = (deg: number) => {
    return deg * Math.PI / 180;
};

export async function distanceBetweenIP(ip1: string, ip2: string) {
    let lookup1 = await geoIP(ip1);
    let lookup2 = await geoIP(ip2);

    if (!lookup1.coordinates || !lookup2.coordinates) {
        return -1;
    }

    var R = 6371; // earth radius

    let lat1 = deg2rad(lookup1.coordinates.lat);
    let lat2 = deg2rad(lookup2.coordinates.lat);
    let latDelta = deg2rad(lookup2.coordinates.lat - lookup1.coordinates.lat);
    let longDelta = deg2rad(lookup2.coordinates.long - lookup1.coordinates.long);

    let a = Math.sin(latDelta / 2) * Math.sin(latDelta / 2)
        + Math.sin(longDelta / 2) * Math.sin(longDelta / 2) * Math.cos(lat1) * Math.cos(lat2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export async function geoIP(ip: string): Promise<GeoIPResponse> {
    let lookup = geoip.lookup(ip);
    if (!lookup) {
        return {
            location_name: '_',
            location_code: '_',
            coordinates: null
        };
    }
    return {
        location_name: lookup.city,
        location_code: lookup.country,
        coordinates: {
            lat: lookup.ll[0],
            long: lookup.ll[1]
        }
    };
}
