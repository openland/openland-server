import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';
import { buildGeoJson } from '../modules/geometry';
import * as Turf from '@turf/turf';
function parseBoolSafe(src: any): boolean | null {
    if (typeof src === 'string') {
        if (src === 'true') {
            return true;
        } else {
            return false;
        }
    } else if (typeof src === 'boolean') {
        return src;
    }
    return null;
}
export function createProspectingIndexer(client: ES.Client) {
    let reader = new UpdateReader('prospecting_indexing_6', DB.Opportunities);
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
        },
        customerUrbynQuery1: {
            type: 'boolean'
        },
        customerUrbynQuery2: {
            type: 'boolean'
        },
        customerUrbynQuery3: {
            type: 'boolean'
        },
        ownerPublic: {
            type: 'boolean'
        },
        ownerNameKeyword: {
            type: 'keyword'
        },
        ownerName: {
            type: 'text'
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
                customerUrbynQuery1: item.lot!!.extras ? parseBoolSafe(item.lot!!.extras!!.urbyn_query_1) : null,
                customerUrbynQuery2: item.lot!!.extras ? parseBoolSafe(item.lot!!.extras!!.urbyn_query_2) : null,
                customerUrbynQuery3: item.lot!!.extras ? parseBoolSafe(item.lot!!.extras!!.urbyn_query_3) : null,
                ownerPublic: item.lot!!.extras ? parseBoolSafe(item.lot!!.extras!!.owner_public) : null,
                ownerNameKeyword: item.lot!!.extras ? item.lot!!.extras!!.owner_name : null,
                ownerName: item.lot!!.extras ? item.lot!!.extras!!.owner_name : null,
                createdAt: (item as any).createdAt,
                updatedAt: (item as any).updatedAt,
            }
        };
    });
    reader.enalbeAutoOutOfOrder();

    return reader;
}