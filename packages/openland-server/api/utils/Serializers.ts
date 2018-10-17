import { Geometry, Polygon } from '../../modules/geometry';

function convertPolygon(polygon: Polygon) {
    let res = [];
    res.push(polygon.coordinates.map((c) => [c.longitude, c.latitude]));
    if (polygon.inner) {
        for (let p of polygon.inner) {
            res.push(p.map((c) => [c.longitude, c.latitude]));
        }
    }
    return res;
}

export function serializeGeometry(geometry?: Geometry | null): string | null {
    if (!geometry) {
        return null;
    }

    return JSON.stringify(geometry.polygons.map(convertPolygon));
}