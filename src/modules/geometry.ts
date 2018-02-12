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