import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';
import { buildGeoJson } from '../modules/geometry';
import * as Turf from '@turf/turf';

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

    let reader = new UpdateReader('lots_indexing_19', DB.Lot);

    reader.elastic(client, 'parcels', 'parcel', {
        geometry: {
            type: 'geo_shape',
            tree: 'quadtree',
            precision: '10m'
        },
        center: {
            type: 'geo_point'
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
        },
        yearBuilt: {
            type: 'integer'
        },
        stories: {
            type: 'integer'
        },
        units: {
            type: 'integer'
        },
        zoning: {
            type: 'keyword'
        },
        displayId: {
            type: 'text'
        },
        blockSourceId: {
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
    }, {
        model: DB.StreetNumber,
        as: 'streetNumbers',
        include: [{
            model: DB.Street,
            as: 'street',
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
        }]
    }]);

    reader.indexer((item) => {
        let geometry = null;
        let center = null;
        if (item.geometry) {
            geometry = buildGeoJson(item.geometry);
            let ctr = Turf.centerOfMass(geometry);
            center = { lon: ctr.geometry!!.coordinates[0], lat: ctr.geometry!!.coordinates[1] };
        }
        let address = item.streetNumbers!!.map((v) => {
            let res = `${v.number}`;
            if (v.suffix) {
                res += v.suffix;
            }
            res += ' ' + v.street!!.name + ' ' + v.street!!.suffix;
            return res;
        }).join();
        return {
            id: item.id!!,
            doc: {
                cityId: item.cityId!!,
                lotId: item.lotId!!,
                blockId: item.block ? item.block.blockId : null,
                blockSourceId: item.block ? item.block.id : null,
                geometry: geometry,
                center: center,
                extras: item.extras,
                landValue: item.extras ? parseIntSafe(item.extras.land_value) : null,
                improvementValue: item.extras ? parseIntSafe(item.extras.improvement_value) : null,
                fixturesValue: item.extras ? parseIntSafe(item.extras.fixtures_value) : null,
                propValue: item.extras ? parseIntSafe(item.extras.personal_prop_value) : null,
                yearBuilt: item.extras ? parseIntSafe(item.extras.yearBuilt) : null,
                stories: item.extras ? parseIntSafe(item.extras.count_stories) : null,
                units: item.extras ? parseIntSafe(item.extras.count_units) : null,
                zoning: item.extras ? item.extras.zoning : null,
                displayId: item.extras ? item.extras.displayId : null,
                addresses: item.streetNumbers!!.map((v) => ({
                    streetNumber: v.number,
                    streetNumberSuffix: v.suffix,
                    street: v.street!!.name,
                    streetSuffix: v.street!!.suffix,
                    city: v.street!!.city!!.name,
                    county: v.street!!.city!!.county!!.name,
                    stateCode: v.street!!.city!!.county!!.state!!.code,
                    state: v.street!!.city!!.county!!.state!!.name,
                })),
                address: address,
                currentUse: item.metadata!!.currentUse,
                available: item.metadata!!.available
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