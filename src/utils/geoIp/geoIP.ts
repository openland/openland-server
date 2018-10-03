import geoIpv4 from './geo_ip_v4.json';

// [fromIp, toIp, location_code, location_name]
export type GeoIPRecord = [number, number, string, string];

export type GeoIPResponse = {
    location_code: string,
    location_name: string
};

export function geoIP(ip: string): GeoIPResponse {
    let parsedIp = parseIp(ip);

    if (parsedIp === 2130706433) {
        return {
            location_code: 'Localhost',
            location_name: 'Localhost'
        };
    }

    if (!parsedIp) {
        return {
            location_code: 'Unknown',
            location_name: 'Unknown'
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

function parseIp(ip: string): number|null {
    // ::ffff:127.0.0.1
    if (ip.startsWith('::ffff:')) {
        ip = ip.replace('::ffff:', '');
    }
    if (!/^(\d{1,3}).(\d{1,3}).(\d{1,3}).(\d{1,3})$/.test(ip)) {
        // ipV6 not supported yet
        return null;
    }

    let nums = ip.split('.').map(p => parseInt(p, 10));

    return ( (nums[3]) | (nums[2] << 8) | (nums[1] << 16) | (nums[0] << 24) ) >>> 0;
}
