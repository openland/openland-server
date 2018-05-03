import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';

export function createIncidentsIndexer(client: ES.Client) {

    let reader = new UpdateReader('reader_incidents', 1, DB.Incident);

    reader.elastic(client, 'incidents', 'incident', {
        location: {
            type: 'geo_point'
        }
    });

    reader.indexer((item) => {
        let location = undefined;
        if (item.geo !== null) {
            location = {
                lat: item.geo!!.latitude,
                lon: item.geo!!.longitude
            };
        }
        return {
            id: item.id!!,
            doc: {
                incidentNumber: item.incidentNumber,
                description: item.description,
                category: item.category,
                date: item.date,
                location: location
            }
        };
    });

    return reader;
}