import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';

export function startIncidentsIndexer(client: ES.Client) {

    let reader = new UpdateReader('incidents_indexing_1', DB.Incident);

    reader.elastic(client, 'incidents', 'incident', {
        location: {
            type: 'geo_shape',
            tree: 'quadtree',
            precision: '1m'
        }
    });

    reader.indexer((item) => {
        let location = undefined;
        if (item.geo !== null) {
            location = {
                type: 'point',
                coordinates: [item.geo!!.longitude, item.geo!!.latitude]
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

    reader.start();
}