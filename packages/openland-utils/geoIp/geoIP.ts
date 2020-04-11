import geoIpv4 from './geo_ip_v4.json';
import countries from './countries.json';
import * as geoip from 'geoip-lite';

// [fromIp, toIp, location_code, location_name]
export type GeoIPRecord = [number, number, string, string];

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
        return internalGeoIP(ip);
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

//
// Internal
//

export async function internalGeoIP(ip: string): Promise<GeoIPResponse> {
    let parsedIp = parseIp(ip);

    if (parsedIp === 2130706433) {
        return {
            location_code: 'Localhost',
            location_name: 'Localhost',
            coordinates: null
        };
    }

    if (!parsedIp) {
        return {
            location_code: 'Unknown',
            location_name: 'Unknown',
            coordinates: null
        };
    }

    return doGeoIP(parsedIp);
}

function doGeoIP(ip: number, from?: number, to?: number): GeoIPResponse {
    if (!from && !to) {
        from = 0;
        to = geoIpv4.length;
    }

    let mid = Math.floor((from! + to!) / 2);

    let status = ipInRange(ip, geoIpv4[mid]);

    if (status === 0) {
        let data = geoIpv4[mid];

        return {
            location_code: data[2],
            location_name: data[3],
            coordinates: countries[data[2]] || null
        };
    }
    if (status === 1) {
        return doGeoIP(ip, mid + 1, to);
    }
    if (status === -1) {
        return doGeoIP(ip, from, mid - 1);
    }

    throw new Error('geo ip error');
}

function ipInRange(ip: number, range: GeoIPRecord) {
    if (ip < range[0]) {
        return -1;
    }
    if (ip > range[1]) {
        return 1;
    }
    return 0;
}

function parseIp(ip: string): number | null {
    // ::ffff:127.0.0.1
    if (ip.startsWith('::ffff:')) {
        ip = ip.replace('::ffff:', '');
    }
    if (!/^(\d{1,3}).(\d{1,3}).(\d{1,3}).(\d{1,3})$/.test(ip)) {
        // ipV6 not supported yet
        return null;
    }

    let nums = ip.split('.').map(p => parseInt(p, 10));

    return ((nums[3]) | (nums[2] << 8) | (nums[1] << 16) | (nums[0] << 24)) >>> 0;
}
