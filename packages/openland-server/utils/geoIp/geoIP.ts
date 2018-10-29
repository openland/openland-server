import geoIpv4 from './geo_ip_v4.json';
import request from 'request';
import countries from './countries.json';
import { CacheRepository } from 'openland-module-cache/CacheRepository.js';

// [fromIp, toIp, location_code, location_name]
export type GeoIPRecord = [number, number, string, string];

export type GeoIPResponse = {
    location_code: string,
    location_name: string,
    coordinates: { long: number, lat: number } | null
};

export async function geoIP(ip: string): Promise<GeoIPResponse> {
    return externalGeoIP(ip);
}

//
// ipstack
//

const IPStackCache = new CacheRepository<any>('ipstack');

async function fetchIPStack(ip: string): Promise<any> {
    let cached = await IPStackCache.read(ip);

    if (cached) {
        return cached;
    }

    let data = await ipStackCall(ip);

    await IPStackCache.write(ip, data);

    return data;
}

async function ipStackCall(ip: string) {
    return new Promise<any>((resolve, reject) => {
        request({
            method: 'GET',
            url: 'https://ipstack.com/ipstack_api.php?ip=' + ip,
        }, (error, response, body) => {
            if (!error && response.statusCode === 200) {
                resolve(JSON.parse(body));
            } else {
                reject(new Error('ipstack error'));
            }
        });
    });
}

async function externalGeoIP(ip: string): Promise<GeoIPResponse> {
    let data = await fetchIPStack(ip);

    return {
        location_code: data.country_code || 'Unknown',
        location_name: data.country_name || 'Unknown',
        coordinates: data.latitude ?  {
            lat: data.latitude,
            long: data.longitude
        } : null
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
