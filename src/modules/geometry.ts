export interface Geometry {
    polygons: Polygon[];
}

export interface Polygon {
    coordinates: Point[];
}

export interface Point {
    latitude: number;
    longitude: number;
}

export function buildGeometryFromInput(input: number[][][]): Geometry {
    return {
        polygons: input.map((v) => ({ coordinates: v.map((c) => ({ latitude: c[1], longitude: c[0] })) }))
    };
}

export function buildGeoJson(src: Geometry) {
    // console.warn(.coordinates.length);
    return {
        type: 'MultiPolygon',
        coordinates: src.polygons
            .filter((v) => v.coordinates.length >= 4)
            .map((v) => [v.coordinates.map((c) => [c.longitude, c.latitude])])
    };
}