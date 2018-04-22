import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';
import { buildGeoJson } from '../modules/geometry';
import * as Turf from '@turf/turf';

export function createProspectingIndexer(client: ES.Client) {
    let reader = new UpdateReader('prospecting_indexing_4', DB.Opportunities);
    reader.elastic(client, 'prospecting', 'opportunity', {
        geometry: {
            type: 'geo_shape',
            tree: 'quadtree',
            precision: '10m'
        },
        center: {
            type: 'geo_point'
        },
        orgId: {
            type: 'integer'
        },
        createdAt: {
            type: 'date'
        },
        updatedAt: {
            type: 'date'
        },
        area: {
            type: 'integer'
        },
        state: {
            type: 'keyword'
        }
    });
    reader.include([{
        model: DB.Lot,
        as: 'lot'
    }]);
    reader.indexer((item) => {
        let geometry = null;
        let center = null;
        if (item.lot!!.geometry) {
            geometry = buildGeoJson(item.lot!!.geometry!!);
            let ctr = Turf.centerOfMass(geometry);
            center = { lon: ctr.geometry!!.coordinates[0], lat: ctr.geometry!!.coordinates[1] };
        }
        return {
            id: item.id!!,
            doc: {
                geometry,
                center,
                area: item.lot!!.extras!!.assessor_area ? item.lot!!.extras!!.assessor_area : item.lot!!.extras!!.area,
                state: item.state,
                orgId: item.organizationId,
                createdAt: (item as any).createdAt,
                updatedAt: (item as any).updatedAt,
            }
        };
    });
    reader.enalbeAutoOutOfOrder();

    return reader;
}