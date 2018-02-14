import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';
import { buildGeoJson } from '../modules/geometry';

function parseIntSafe(src: any) {
    if (typeof src === 'string') {
        try {
            return parseInt(src, 10);
        } catch {
            // Just ignore
        }
    } else if (typeof src === 'number') {
        return src;
    }
    return null;
}

export function startLotsIndexer(client: ES.Client) {

    let reader = new UpdateReader('lots_indexing_12', DB.Lot);

    reader.elastic(client, 'parcels', 'parcel', {
        geometry: {
            type: 'geo_shape',
            tree: 'quadtree',
            precision: '1m'
        },
        landValue: {
            type: 'integer'
        },
        improvementValue: {
            type: 'integer'
        },
        propValue: {
            type: 'integer'
        },
        fixturesValue: {
            type: 'integer'
        }
    });

    reader.include([{
        model: DB.Block,
        as: 'block',
        include: [{
            model: DB.City,
            as: 'city',
            include: [{
                model: DB.County,
                as: 'county',
                include: [{
                    model: DB.State,
                    as: 'state'
                }]
            }]
        }]
    }]);

    reader.indexer((item) => {
        let geometry = null;
        if (item.geometry) {
            geometry = buildGeoJson(item.geometry);
        }
        return {
            id: item.id!!,
            doc: {
                cityId: item.cityId!!,
                lotId: item.lotId!!,
                blockId: item.block ? item.block.blockId : null,
                geometry: geometry,
                extras: item.extras,
                landValue: item.extras ? parseIntSafe(item.extras.land_value) : null,
                improvementValue: item.extras ? parseIntSafe(item.extras.improvement_value) : null,
                fixturesValue: item.extras ? parseIntSafe(item.extras.fixtures_value) : null,
                propValue: item.extras ? parseIntSafe(item.extras.personal_prop_value) : null,
            }
        };
    });

    reader.start();

    // if (mapBoxConfigured()) {
    //     reader = new UpdateReader('lots_indexing_mapbox_2', DB.Lot);
    //     reader.include([{
    //         model: DB.Block,
    //         as: 'block',
    //         include: [{
    //             model: DB.City,
    //             as: 'city',
    //             include: [{
    //                 model: DB.County,
    //                 as: 'county',
    //                 include: [{
    //                     model: DB.State,
    //                     as: 'state'
    //                 }]
    //             }]
    //         }]
    //     }]);
    //     reader.processor(async (data) => {
    //         for (let item of data) {
    //             if (item.geometry === null) {
    //                 continue;
    //             }

    //             let id = item.block!!.blockId + '_' + item.lotId;

    //             let geometry = item.geometry!!.polygons
    //                 .filter((v) => v.coordinates.length >= 4)
    //                 .map((v) => ({
    //                     type: 'Polygon',
    //                     coordinates: [v.coordinates.map((c) => [c.longitude, c.latitude])]
    //                 }))[0];

    //             await uploadFeature('cjctj2irl0k5z2wvtz46ld417', id, geometry);
    //         }
    //     });
    //     reader.start();
    // }
}