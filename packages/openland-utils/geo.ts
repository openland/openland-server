import { geoIP } from 'openland-utils/geoIP';

export type LatLong = { long: number, lat: number };

const deg2rad = (deg: number) => {
    return deg * Math.PI / 180;
};

export function distanceBetween(cords1: LatLong, cords2: LatLong) {
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

function shuffle<T>(a: T[]) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function pickClosest<T>(opts: {
    location: LatLong,
    data: T[],
    ipExtractor: (src: T) => string | null,
    tolerance?: number
}): T {
    if (opts.data.length === 0) {
        throw Error('Data is empty');
    }
    if (opts.data.length === 1) {
        return opts.data[0];
    }

    let items: { value: T, loc: LatLong }[] = [];
    for (let d of opts.data) {
        let ip = opts.ipExtractor(d);
        if (!ip) {
            continue;
        }
        let location = geoIP(ip);
        if (!location.coordinates) {
            continue;
        }
        items.push({ value: d, loc: location.coordinates });
    }

    // Pick random if no locations are available
    if (opts.data.length <= 1) {
        return opts.data[Math.floor(Math.random() * opts.data.length)];
    }

    // Shuffle items for randomization
    shuffle(items);

    // Find nearest
    let nearest: T | null = null;
    let nearestDistance: number | null = null;
    for (let w of items) {
        let distance = distanceBetween(w.loc, opts.location);

        if (!nearest) {
            nearest = w.value;
            nearestDistance = distance;
        } else {
            if (opts.tolerance !== undefined) {
                if (Math.abs(distance - nearestDistance!) > opts.tolerance) {
                    nearest = w.value;
                    nearestDistance = distance;
                }
            } else {
                if (distance < nearestDistance!) {
                    nearest = w.value;
                    nearestDistance = distance;
                }
            }
        }
    }

    // Just in case
    if (!nearest) {
        return opts.data[Math.floor(Math.random() * opts.data.length)];
    }

    return nearest;
}