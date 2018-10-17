import fetch from 'node-fetch';

interface GeoJsonPolygon {
    type: string;
    coordinates: number[][][];
}

type GeoJsonGeometry = GeoJsonPolygon;

export function mapBoxConfigured(): boolean {
    if (process.env.MAPBOX_TOKEN && process.env.MAPBOX_USER) {
        return true;
    } else {
        return false;
    }
}

export async function uploadFeature(dataset: string, id: string, geometry: GeoJsonGeometry) {
    if (!mapBoxConfigured()) {
        throw new Error('Map Box import is not configured');
    }
    let url = `https://api.mapbox.com/datasets/v1/${process.env.MAPBOX_USER}/${dataset}/features/${id}?access_token=${process.env.MAPBOX_TOKEN}`;
    try {
        let body = JSON.stringify({
            type: 'Feature',
            geometry: geometry,
            properties: {
                title: id
            }
        });
        let res = await fetch(url, {
            method: 'put',
            headers: {
                'Content-Type': 'application/json'
            },
            body: body
        });
        if (!res.ok) {
            throw new Error('Error during query: ' + res);
        }
    } catch (e) {
        console.warn(e);
        throw e;
    }
}