import { DB, Lot } from '../../tables';
import { parseIntSafe, parseBoolSafe } from '../../utils/parsing';
import * as Turf from '@turf/turf';
import { buildGeoJson } from '../../modules/geometry';

export const ParcelsProperties = {
    parcelId: {
        type: 'integer'
    },
    displayId: {
        type: 'text'
    },
    searchId: {
        type: 'keyword'
    },
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
    },
    compatibleBuildings: {
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
    ownerName: {
        type: 'text'
    },
    ownerNameKw: {
        type: 'keyword'
    },
    unitCapacity: {
        type: 'integer'
    }
};

export const ParcelsInclude = [
    {
        model: DB.Block, as: 'block'
    },
    {
        model: DB.StreetNumber, as: 'streetNumbers', include: [{
            model: DB.Street, as: 'street', include: [{
                model: DB.City, as: 'city', include: [{
                    model: DB.County, as: 'county', include: [{
                        model: DB.State, as: 'state'
                    }]
                }]
            }]
        }]
    }];

export function indexParcel(item: Lot) {
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
        if (item.extras && item.extras.address) {
            address.push(item.extras!!.address!!.toString());
        }
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

        let compatibleBuildings: string[] = [];
        if (item.extras && item.extras.project_kassita1 === 'true') {
            compatibleBuildings.push('kasita-1');
        }
        if (item.extras && item.extras.project_kassita2 === 'true') {
            compatibleBuildings.push('kasita-2');
        }
    return {
        parcelId: item.id,
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
        area: item.extras!!.assessor_area ? item.extras!!.assessor_area : item.extras!!.area,
        distance: distance,
        retired: item.retired,
        compatibleBuildings: compatibleBuildings,
        customerUrbynQuery1: item.extras ? parseBoolSafe(item.extras.urbyn_query_1) : null,
        customerUrbynQuery2: item.extras ? parseBoolSafe(item.extras.urbyn_query_2) : null,
        customerUrbynQuery3: item.extras ? parseBoolSafe(item.extras.urbyn_query_3) : null,
        ownerPublic: item.extras ? parseBoolSafe(item.extras.owner_public) : null,
        unitCapacity: item.extras ? parseIntSafe(item.extras!!.unit_capacity) : null,
        ownerName: item.extras ? item.extras.owner_name : null,
        ownerNameKw: item.extras ? item.extras.owner_name : null
    };
}