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

export function startLotsIndexer(client: ES.Client) {

    let reader = new UpdateReader('lots_indexing_27', DB.Lot);

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
        searchId: {
            type: 'keyword'
        },
        blockSourceId: {
            type: 'integer'
        },
        area: {
            type: 'integer'
        },
        landUse: {
            type: 'keyword'
        },
        distance: {
            type: 'integer'
        },
        retired: {
            type: 'boolean'
        },
        buildings: {
            type: 'integer'
        },
        vacant: {
            type: 'boolean'
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
        });
        let distance = null;
        if (item.extras) {
            if (item.extras.nearest_muni_distance && (!distance || distance > item.extras.nearest_muni_distance!!)) {
                distance = Math.round(item.extras.nearest_muni_distance as number);
            }
            if (item.extras.nearest_caltrain_distance && (!distance || distance > item.extras.nearest_caltrain_distance!!)) {
                distance = Math.round(item.extras.nearest_caltrain_distance as number);
            }
            if (item.extras.nearest_bart_distance && (!distance || distance > item.extras.nearest_bart_distance!!)) {
                distance = Math.round(item.extras.nearest_bart_distance as number);
            }
        }

        // Building Search IDs
        let searchId: string[] = [];
        searchId.push(item.id!!.toString());
        if (item.extras && item.extras.displayId) {
            searchId.push(item.extras.displayId as string);
        }
        if (item.extras && item.extras.searchId) {
            searchId.push(...(item.extras.searchId as string[]));
        }

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
                units: item.extras ? parseIntSafe(item.extras.count_rooms) : null,
                buildings: item.extras ? parseIntSafe(item.extras.count_units) : null,
                vacant: item.extras ? parseBoolSafe(item.extras.is_vacant) : null,
                zoning: item.extras ? item.extras.zoning : null,
                displayId: item.extras ? item.extras.displayId : null,
                searchId: searchId,
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
                address: address.join(),
                addressRaw: address,
                currentUse: item.metadata!!.currentUse,
                available: item.metadata!!.available,
                isOkForTower: item.metadata!!.isOkForTower,
                landUse: item.extras!!.land_use,
                area: item.extras!!.area,
                distance: distance,
                retired: item.retired
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