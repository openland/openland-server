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