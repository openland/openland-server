export interface Geometry {
    polygons: Polygon[];
}

export interface Polygon {
    coordinates: Point[];
    inner?: Point[][] | null;
}

export interface Point {
    latitude: number;
    longitude: number;
}

export function buildGeometryFromInput(input: number[][][][]): Geometry {
    return {
        polygons: input.map((v) => ({
            coordinates: v[0].map((c) => ({ latitude: c[1], longitude: c[0] })),
            inner: v.length > 1 ? v.slice(1).map((i) => i.map((c) => ({ latitude: c[1], longitude: c[0] }))) : null
        }))
    };
}

function convertPolygonCoordnates(polygon: Polygon) {
    let res = [];
    res.push(polygon.coordinates.map((c) => [c.longitude, c.latitude]));
    if (polygon.inner && polygon.inner.length > 0) {
        for (let circle of polygon.inner) {
            res.push(circle.map((c) => [c.longitude, c.latitude]));
        }
    }
    return res;
}

export function buildGeoJson(src: Geometry) {
    return {
        type: 'MultiPolygon',
        coordinates: src.polygons.map((v) => convertPolygonCoordnates(v))
    };
}