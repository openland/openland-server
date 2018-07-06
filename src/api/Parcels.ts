import { Lot } from '../tables/Lot';
import { Block } from '../tables/Block';
import { Repos } from '../repositories';
import { DB } from '../tables';
import { ElasticClient } from '../indexing';
import * as Turf from '@turf/turf';
import { CallContext } from './utils/CallContext';
import { withPermission, withAuth, withPermissionOptional, withAccountTypeOptional, withAccount, withAny } from './utils/Resolvers';
import { IDs } from './utils/IDs';
import { serializeGeometry } from './utils/Serializers';
import { createRectangle } from '../utils/map';
import { normalizeCapitalized } from '../modules/Normalizer';
import { LotUserDataAttributes } from '../tables/LotUserData';
import { Services } from '../services';
import { UserError } from '../errors/UserError';
import { NotFoundError } from '../errors/NotFoundError';
import { ErrorText } from '../errors/ErrorText';
import { ParcelInput, BlockInput } from './types';

export const Resolver = {
    ParcelUserData: {
        notes: (src: LotUserDataAttributes) => src.notes
    },
    Parcel: {
        id: async (src: Lot) => {
            let tag = (await Repos.Area.resolveCityInfo(src.cityId!!))!!.tag!!;
            return tag + '_' + src.lotId;
        },
        number: async (src: Lot) => {
            // NYC Format
            if (src.extras && src.extras.nyc_bbl) {
                let bbl = (src.extras.nyc_bbl as string);
                let borough = parseInt(bbl.slice(0, 1), 10);
                let blockPadded = bbl.slice(1, 1 + 5);
                let block = parseInt(blockPadded, 10);
                let lotPadded = bbl.slice(6, 6 + 4);
                let lot = parseInt(bbl.slice(6, 6 + 4), 10);
                let boroughName = 'Manhattan';
                if (borough === 2) {
                    boroughName = 'Bronx';
                } else if (borough === 3) {
                    boroughName = 'Brooklyn';
                } else if (borough === 4) {
                    boroughName = 'Queens';
                } else if (borough === 5) {
                    boroughName = 'Staten Island';
                }
                return {
                    block: block,
                    blockPadded: blockPadded,
                    lot: lot,
                    lotPadded: lotPadded,
                    boroughId: borough,
                    borough: boroughName,
                    title: `${borough}-${blockPadded}-${lotPadded}`
                };
            }

            // Fallback
            if (src.extras && src.extras.displayId) {
                return {
                    title: src.extras.displayId
                };
            } else if (src.primaryParcelId) {
                return {
                    title: (await DB.ParcelID.findById(src.primaryParcelId))!!.parcelId!!
                };
            } else {
                return {
                    title: src.lotId
                };
            }
        },

        // Deprecated IDs
        title: async (src: Lot) => {
            if (src.extras && src.extras.displayId) {
                return src.extras.displayId;
            } else if (src.primaryParcelId) {
                return (await DB.ParcelID.findById(src.primaryParcelId))!!.parcelId!!;
            } else {
                return src.lotId;
            }
        },
        block: (src: Lot) => src.blockId ? Repos.Blocks.fetchBlock(src.blockId!!) : null,

        // Geometry
        geometry: (src: Lot) => serializeGeometry(src.geometry),
        center: (src: Lot) => {
            if (src.geometry) {
                let ctr = Turf.centerOfMass({ type: 'MultiPolygon', coordinates: src.geometry.polygons.map((v) => [v.coordinates.map((v2) => [v2.longitude, v2.latitude])]) });
                return { longitude: ctr.geometry!!.coordinates[0], latitude: ctr.geometry!!.coordinates[1] };
            }
            return null;
        },

        // Addresses
        address: async (src: Lot) => {
            let numbers = src.streetNumbers;
            if (!numbers) {
                numbers = await src.getStreetNumbers({
                    include: [{
                        model: DB.Street,
                        as: 'street'
                    }]
                });
            }
            if (!numbers) {
                numbers = [];
            }
            if (numbers.length === 0) {
                return src.extras ? src.extras.address ? normalizeCapitalized(src.extras.address!!.toString()) : null : null;
            }

            let converted = numbers.map((n) => ({
                streetId: n.street!!.id,
                streetName: n.street!!.name!!,
                streetNameSuffix: n.street!!.suffix,
                streetNumber: n.number!!,
                streetNumberSuffix: n.suffix!!
            }));

            let streets = new Map<string, { numbers: { number: number, suffix: string | null }[] }>();

            // Grouping By street name
            for (let addr of converted) {
                let name = addr.streetName;
                if (addr.streetNameSuffix) {
                    name += ' ' + addr.streetNameSuffix;
                }
                if (streets.has(name)) {
                    let street = streets.get(name)!!;
                    street.numbers.push({ number: addr.streetNumber, suffix: addr.streetNumberSuffix });
                } else {
                    streets.set(name, { numbers: [{ number: addr.streetNumber, suffix: addr.streetNumberSuffix }] });
                }
            }

            // Only first number and first street
            let parts: string[] = [];
            let addr2 = Array.from(streets.keys()).sort()[0];
            let numbers2 = streets.get(addr2)!!;
            let formattedNumbers = numbers2.numbers.map((v) => v.number + (v.suffix ? v.suffix : '')).sort()[0];
            parts.push(formattedNumbers + ' ' + addr2);
            return parts.join('; ');
        },
        addresses: async (src: Lot) => {
            let numbers = src.streetNumbers;
            if (!numbers) {
                numbers = await src.getStreetNumbers({
                    include: [{
                        model: DB.Street,
                        as: 'street'
                    }]
                });
            }
            if (!numbers) {
                numbers = [];
            }
            return numbers.map((n) => ({
                streetId: n.street!!.id,
                streetName: n.street!!.name,
                streetNameSuffix: n.street!!.suffix,
                streetNumber: n.number,
                streetNumberSuffix: n.suffix
            }));
        },
        extrasAddress: (src: Lot) => src.extras ? src.extras.address ? normalizeCapitalized(src.extras.address!!.toString()) : null : null,

        metadata: (src: Lot) => {
            return {
                description: src.metadata!!.description,
                currentUse: src.metadata!!.currentUse,
                available: src.metadata!!.available,
                isOkForTower: src.metadata!!.isOkForTower,
            };
        },

        likes: async (src: Lot, args: {}, context: CallContext) => {
            let likes = await src.getLikes();
            let liked = context.uid !== undefined && likes.find((v) => v.id === context.uid) !== undefined;
            return {
                count: likes.length,
                liked: liked
            };
        },

        permits: async (src: Lot) => {
            return DB.Permit.findAll({
                where: {
                    parcelId: src.id
                },
                include: [{
                    model: DB.StreetNumber,
                    as: 'streetNumbers',
                    include: [{
                        model: DB.Street,
                        as: 'street'
                    }],
                }],
                order: [['permitCreated', 'DESC']]
            });
        },

        city: async (src: Lot) => Repos.Area.resolveCityInfo(src.cityId!!),

        //
        // Dimensions
        //
        area: (src: Lot) => {
            if (src.extras && src.extras.assessor_area) {
                return {
                    value: src.extras.assessor_area,
                    source: 'EXTERNAL'
                };
            }
            if (src.extras && src.extras.area) {
                return {
                    value: src.extras.area,
                    source: 'INTERNAL'
                };
            }
            return null;
        },
        front: (src: Lot) => {
            if (src.extras && src.extras.assessor_front) {
                return {
                    value: src.extras.assessor_front,
                    source: 'EXTERNAL'
                };
            }
            return null;
        },
        depth: (src: Lot) => {
            if (src.extras && src.extras.assessor_depth) {
                return {
                    value: src.extras.assessor_depth,
                    source: 'EXTERNAL'
                };
            }
            return null;
        },

        retired: (src: Lot) => src.retired,

        extrasArea: (src: Lot) => (src.extras && src.extras.area) ? src.extras.area : null,
        extrasAssessorArea: (src: Lot) => (src.extras && src.extras.assessor_area) ? src.extras.assessor_area : null,
        extrasAssessorFront: (src: Lot) => (src.extras && src.extras.assessor_front) ? src.extras.assessor_front : null,
        extrasAssessorDepth: (src: Lot) => (src.extras && src.extras.assessor_depth) ? src.extras.assessor_depth : null,

        extrasShapeSides: (src: Lot) => {
            let res = [];
            if (src.extras) {
                if (src.extras.side1) {
                    res.push(src.extras.side1 as number);
                }
                if (src.extras.side1 && src.extras.side2) {
                    res.push(src.extras.side2 as number);
                }
                if (src.extras.side1 && src.extras.side2 && src.extras.side3) {
                    res.push(src.extras.side3 as number);
                }
                if (src.extras.side1 && src.extras.side2 && src.extras.side3 && src.extras.side4) {
                    res.push(src.extras.side4 as number);
                }
            }
            return res;
        },

        //
        // Extras
        //

        extrasMetroDistance: (src: Lot) => (src.extras && src.extras.nearest_muni_distance) ? Math.round(src.extras.nearest_muni_distance as number) : null,
        extrasMetroStation: (src: Lot) => (src.extras && src.extras.nearest_muni) ? src.extras.nearest_muni : null,

        extrasTrainDistance: (src: Lot) => (src.extras && src.extras.nearest_caltrain_distance) ? Math.round(src.extras.nearest_caltrain_distance as number) : null,
        extrasTrainStation: (src: Lot) => (src.extras && src.extras.nearest_caltrain) ? src.extras.nearest_caltrain : null,

        extrasTrainLocalDistance: (src: Lot) => (src.extras && src.extras.nearest_bart_distance) ? Math.round(src.extras.nearest_bart_distance as number) : null,
        extrasTrainLocalStation: (src: Lot) => (src.extras && src.extras.nearest_bart) ? src.extras.nearest_bart : null,

        extrasNearestTransitDistance: (src: Lot) => {
            if (!src.extras) {
                return null;
            }
            let res = null;
            if (src.extras.nearest_muni_distance && (!res || res < src.extras.nearest_muni_distance!!)) {
                res = Math.round(src.extras.nearest_muni_distance as number);
            }
            if (src.extras.nearest_caltrain_distance && (!res || res < src.extras.nearest_caltrain_distance!!)) {
                res = Math.round(src.extras.nearest_caltrain_distance as number);
            }
            if (src.extras.nearest_bart_distance && (!res || res < src.extras.nearest_bart_distance!!)) {
                res = Math.round(src.extras.nearest_bart_distance as number);
            }
            return res;
        },
        extrasNearestTransitType: (src: Lot) => {
            if (!src.extras) {
                return null;
            }
            let res = null;
            let resTitle = null;
            if (src.extras.nearest_muni_distance && (!res || res < src.extras.nearest_muni_distance!!)) {
                res = Math.round(src.extras.nearest_muni_distance as number);
                resTitle = 'MUNI Metro';
            }
            if (src.extras.nearest_caltrain_distance && (!res || res < src.extras.nearest_caltrain_distance!!)) {
                res = Math.round(src.extras.nearest_caltrain_distance as number);
                resTitle = 'Caltrain';
            }
            if (src.extras.nearest_bart_distance && (!res || res < src.extras.nearest_bart_distance!!)) {
                res = Math.round(src.extras.nearest_bart_distance as number);
                resTitle = 'BART';
            }
            return resTitle;
        },
        extrasNearestTransitStation: (src: Lot) => {
            if (!src.extras) {
                return null;
            }
            let res = null;
            let resTitle = null;
            if (src.extras.nearest_muni_distance && (!res || res < src.extras.nearest_muni_distance!!)) {
                res = Math.round(src.extras.nearest_muni_distance as number);
                resTitle = src.extras.nearest_muni;
            }
            if (src.extras.nearest_caltrain_distance && (!res || res < src.extras.nearest_caltrain_distance!!)) {
                res = Math.round(src.extras.nearest_caltrain_distance as number);
                resTitle = src.extras.nearest_caltrain;
            }
            if (src.extras.nearest_bart_distance && (!res || res < src.extras.nearest_bart_distance!!)) {
                res = Math.round(src.extras.nearest_bart_distance as number);
                resTitle = src.extras.nearest_bart;
            }
            return resTitle;
        },

        extrasZoning: (src: Lot) => src.extras ? src.extras.zoning : null,

        extrasLandUse: (src: Lot) => src.extras ? src.extras.land_use : null,
        extrasSalesDate: (src: Lot) => src.extras ? src.extras.sales_date : null,
        extrasSalesPriorDate: (src: Lot) => src.extras ? src.extras.sales_date_prior : null,
        extrasRecordationDate: (src: Lot) => src.extras ? src.extras.recordation_date : null,

        extrasUnitCapacity: (src: Lot) => src.extras ? src.extras.unit_capacity : null,
        extrasUnitCapacityFar: (src: Lot) => src.extras ? src.extras.far : null,
        extrasUnitCapacityDencity: (src: Lot) => src.extras ? src.extras.dencity_factor : null,

        extrasSupervisorDistrict: (src: Lot) => src.extras ? src.extras.supervisor_id : null,
        extrasLandValue: (src: Lot) => src.extras ? src.extras.land_value : null,
        extrasImprovementValue: (src: Lot) => src.extras ? src.extras.improvement_value : null,
        extrasPropertyValue: (src: Lot) => src.extras ? src.extras.personal_prop_value : null,
        extrasFixturesValue: (src: Lot) => src.extras ? src.extras.fixtures_value : null,
        extrasStories: (src: Lot) => src.extras ? src.extras.count_stories : null,
        extrasUnits: (src: Lot) => src.extras ? src.extras.count_units : null,
        extrasRooms: (src: Lot) => src.extras ? src.extras.count_rooms : null,
        extrasVacant: (src: Lot) => src.extras ? src.extras.is_vacant === 'true' : null,
        extrasBathrooms: (src: Lot) => src.extras ? src.extras.count_bathrooms : null,
        extrasBedrooms: (src: Lot) => src.extras ? src.extras.count_bedrooms : null,
        extrasYear: (src: Lot) => src.extras ? src.extras.year_built : null,
        extrasNeighborhood: (src: Lot) => src.extras ? src.extras.neighbourhoods : null,
        extrasBorough: (src: Lot) => src.extras ? src.extras.borough_name : null,
        extrasOwnerName: async (src: Lot) => {
            if (src.extras) {
                if (src.extras.nyc_bbl) {
                    let bbl = (src.extras.nyc_bbl as string);
                    let borough = parseInt(bbl.slice(0, 1), 10);
                    let block = parseInt(bbl.slice(1, 1 + 5), 10);
                    let lot = parseInt(bbl.slice(6, 6 + 4), 10);
                    let res = await Services.NYCProperties.fetchPropertyInformation(borough, block, lot);
                    if (res.owners.length > 0) {
                        return res.owners.map((v) => normalizeCapitalized(v)).join();
                    }
                }
                if (src.extras.owner_name) {
                    return normalizeCapitalized(src.extras.owner_name!!.toString());
                }
            }
            return null;
        },
        extrasOwnerType: (src: Lot) => src.extras ? src.extras.owner_type : null,
        extrasOwnerPublic: (src: Lot) => src.extras ? src.extras.owner_public === 'true' : null,
        extrasShapeType: (src: Lot) => src.extras ? src.extras.shape_type : null,
        extrasFitProjects: withPermissionOptional<{}, Lot>(['feature-customer-kassita', 'editor', 'software-developer', 'super-admin'], (args, context, src) => {
            if (src.extras && src.extras.analyzed === 'true') {
                let res = [];
                if (src.extras.project_kassita1 === 'true') {
                    res.push('kassita-1');
                }
                if (src.extras.project_kassita2 === 'true') {
                    res.push('kassita-2');
                }
                return res;
            } else {
                return null;
            }
        }),
        compatibleBuildings: withPermissionOptional<{}, Lot>(['feature-customer-kassita', 'editor', 'software-developer', 'super-admin'], (args, context, src) => {
            let res: any[] = [];
            if (src.extras && src.extras.analyzed === 'true') {
                if (src.extras.project_kassita1 === 'true') {
                    let center = null;
                    let shape = null;
                    if (src.extras.project_kassita1_lon && src.extras.project_kassita1_lat) {
                        center = {
                            latitude: src.extras.project_kassita1_lat,
                            longitude: src.extras.project_kassita1_lon
                        };
                        if (src.extras.project_kassita1_angle) {
                            shape = JSON.stringify(createRectangle(src.extras.project_kassita1_lat as number,
                                src.extras.project_kassita1_lon as number,
                                src.extras.project_kassita1_angle as number,
                                3.6576,
                                10.668
                            ));
                        }
                    }
                    res.push({
                        key: 'kassita-1',
                        title: 'Elemynt¹',
                        width: 3.6576,
                        height: 10.668,
                        center: center,
                        angle: src.extras.project_kassita1_angle,
                        shape: shape
                    });
                }
                if (src.extras.project_kassita2 === 'true') {
                    let center = null;
                    let shape = null;
                    if (src.extras.project_kassita2_lon && src.extras.project_kassita2_lat) {
                        center = {
                            latitude: src.extras.project_kassita2_lat,
                            longitude: src.extras.project_kassita2_lon
                        };

                        if (src.extras.project_kassita2_angle) {
                            shape = JSON.stringify(createRectangle(src.extras.project_kassita2_lat as number,
                                src.extras.project_kassita2_lon as number,
                                src.extras.project_kassita2_angle as number,
                                3.048,
                                12.192
                            ));
                        }
                    }
                    res.push({
                        key: 'kassita-2',
                        title: 'Elemynt²',
                        width: 3.048,
                        height: 12.192,
                        center: center,
                        angle: src.extras.project_kassita2_angle,
                        shape: shape
                    });
                }
            }
            return res;
        }),
        extrasAnalyzed: (src: Lot) => src.extras && src.extras.analyzed === 'true',
        opportunity: withAccountTypeOptional<Lot>((src, uid, orgId) => {
            if (orgId) {
                return Repos.Opportunities.findOpportunity(orgId, src.id!!);
            } else {
                return null;
            }
        }),
        userData: withAccountTypeOptional<Lot>(async (src, uid, orgId) => {
            if (orgId) {
                return Repos.Parcels.fetchUserData(orgId, src.id!!);
            } else {
                return null;
            }
        }),
        links: async (src: Lot) => {
            let links: {
                type: string,
                title: string,
                url: string,
                group?: string,
                groupTitle?: string
            }[] = [];
            if (src.extras && src.extras.nyc_bbl) {
                let bbl = (src.extras.nyc_bbl as string);
                let borough = parseInt(bbl.slice(0, 1), 10);
                let block = parseInt(bbl.slice(1, 1 + 5), 10);
                let lot = parseInt(bbl.slice(6, 6 + 4), 10);
                links.push({ type: 'zola', title: 'ZoLa', url: 'https://zola.planning.nyc.gov/lot/' + borough + '/' + block + '/' + lot });
                links.push({ type: 'bisweb', title: 'BISWEB', url: 'http://a810-bisweb.nyc.gov/bisweb/PropertyBrowseByBBLServlet?allborough=' + borough + '&allblock=' + block + '&alllot=' + lot + '&go5=+GO+&requestid=0' });
                links.push({ type: 'acris', title: 'ACRIS', url: 'http://a836-acris.nyc.gov/bblsearch/bblsearch.asp?borough=' + borough + '&block=' + block + '&lot=' + lot });
                links.push({ type: 'taxmap', title: 'Digital Tax Map', url: 'http://maps.nyc.gov/taxmap/map.htm?searchType=BblSearch&featureTypeName=EVERY_BBL&featureName=' + bbl });

                // Fetching Bins
                let bins = (await Services.NYCBisWeb.fetchBlock(borough, block)).lots.find((v) => v.lot === lot);
                if (bins) {
                    for (let bin of bins.bins) {
                        let postfix = '';
                        if (bins.bins.length > 1) {
                            postfix = ' #' + bin;
                        }
                        links.push({
                            type: 'bisweb',
                            group: 'BIN #' + bin,
                            title: 'Certificates of occupancy' + postfix,
                            groupTitle: 'Certificates of occupancy',
                            url: 'http://a810-bisweb.nyc.gov/bisweb/COsByLocationServlet?allbin=' + bin,
                        });
                        links.push({
                            type: 'bisweb',
                            group: 'BIN #' + bin,
                            title: 'Electrical applications' + postfix,
                            groupTitle: 'Electrical applications',
                            url: 'http://a810-bisweb.nyc.gov/bisweb/BECApplicationsByAddressServlet?allbin=' + bin,
                        });
                        links.push({
                            type: 'bisweb',
                            group: 'BIN #' + bin,
                            title: 'Elevator records' + postfix,
                            groupTitle: 'Elevator records',
                            url: 'http://a810-bisweb.nyc.gov/bisweb/ElevatorRecordsByLocationServlet?allbin=' + bin,
                        });
                        links.push({
                            type: 'bisweb',
                            group: 'BIN #' + bin,
                            title: 'Boiler records' + postfix,
                            groupTitle: 'Boiler records',
                            url: 'http://a810-bisweb.nyc.gov/bisweb/BoilerComplianceQueryServlet?allbin=' + bin,
                        });
                        links.push({
                            type: 'bisweb',
                            group: 'BIN #' + bin,
                            title: 'Jobs/fillings' + postfix,
                            groupTitle: 'Jobs/fillings',
                            url: 'http://a810-bisweb.nyc.gov/bisweb/JobsQueryByLocationServlet?requestid=1&allbin=' + bin,
                        });
                        links.push({
                            type: 'bisweb',
                            group: 'BIN #' + bin,
                            title: 'Permits in process' + postfix,
                            groupTitle: 'Permits in process',
                            url: 'http://a810-bisweb.nyc.gov/bisweb/PermitsInProcessIssuedByBinServlet?allbin=' + bin,
                        });
                        links.push({
                            type: 'bisweb',
                            group: 'BIN #' + bin,
                            title: 'Violations - DOB' + postfix,
                            groupTitle: 'Violations - DOB',
                            url: 'http://a810-bisweb.nyc.gov/bisweb/ActionsByLocationServlet?allinquirytype=BXS4OCV3&stypeocv3=V&allbin=' + bin,
                        });
                        links.push({
                            type: 'bisweb',
                            group: 'BIN #' + bin,
                            title: 'Violations - ECB' + postfix,
                            groupTitle: 'Violations - ECB',
                            url: 'http://a810-bisweb.nyc.gov/bisweb/ECBQueryByLocationServlet?allbin=' + bin,
                        });
                    }
                }
            }

            return links;
        }
    },
    Block: {
        id: (src: Block) => IDs.Block.serialize(src.id!!),
        title: (src: Block) => (src.extras && src.extras.displayId) ? src.extras.displayId : src.blockId,
        geometry: (src: Block) => serializeGeometry(src.geometry),
        parcels: (src: Block) => DB.Lot.findAll({ where: { blockId: src.id!! } }),
        extrasArea: (src: Block) => (src.extras && src.extras.area) ? Math.round(src.extras.area as number) : null,
        extrasZoning: async (src: Lot) => {
            let lots = await DB.Lot.findAll({ where: { blockId: src.id!! } });
            let zones = lots.map((src2) => src2.extras ? (src2.extras.zoning ? src2.extras.zoning : []) : []);
            let zonesSet = new Set<string>();
            for (let z of zones) {
                for (let z2 of (z as string[])) {
                    zonesSet.add(z2);
                }
            }
            return Array.from(zonesSet).sort();
        },
        extrasSupervisorDistrict: (src: Block) => src.extras ? src.extras.supervisor_id : null
    },
    Query: {
        blocksConnection: async function (_: any, args: { state: string, county: string, city: string, filter?: string, first: number, after?: string, page?: number }) {
            let cityId = await Repos.Area.resolveCity(args.state, args.county, args.city);
            return await Repos.Blocks.fetchBlocks(cityId, args.first, args.filter, args.after, args.page);
        },
        block: async function (_: any, args: { id: string }) {
            return Repos.Blocks.fetchBlock(IDs.Block.parse(args.id));
        },
        blocksOverlay: async function (_: any, args: { box: { south: number, north: number, east: number, west: number }, limit: number, filterZoning?: string[] | null, query?: string | null }) {
            return Repos.Blocks.fetchGeoBlocks(args.box, args.limit, args.query);
        },
        parcelsConnection: async function (_: any, args: { state: string, county: string, city: string, query?: string, first: number, after?: string, page?: number }) {
            let cityId = await Repos.Area.resolveCity(args.state, args.county, args.city);
            return await Repos.Parcels.fetchParcelsConnection(cityId, args.first, args.query, args.after, args.page);
        },
        parcel: async function (_: any, args: { id: string }) {
            let [city, parcel] = args.id.split('_', 2);
            return Repos.Parcels.fetchParcelByMapId(parcel, await Repos.Area.resolveCityByTag(city));
        },
        parcelsOverlay: async function (_: any, args: { box: { south: number, north: number, east: number, west: number }, limit: number, query?: string | null }) {
            return Repos.Parcels.fetchGeoParcels(args.box, args.limit, args.query);
        },
        alphaParcelMap: withAny<{ box: { south: number, north: number, east: number, west: number }, limit: number, query: string, zoom: number }>(async (args) => {
            return await Repos.Parcels.fetchGeoParcelsClusteredLocal(args.box, args.limit, args.query, args.zoom);
        }),
        alphaAllParcels: withAny<{ state: string, county: string, city: string, query: string }>(async (args) => {
            let cityId = await Repos.Area.resolveCity(args.state, args.county, args.city);
            let parcels = await Repos.Parcels.fetchAllParcels(cityId, args.query);
            return await DB.Lot.findAll({ where: { id: { $in: parcels } } });
        }),
        parcelsStats: async function (_: any, args: { query?: string | null, state?: string | null, county?: string | null, city?: string | null }) {
            let cityId = null;
            if (args.state && args.county && args.city) {
                cityId = await Repos.Area.resolveCity(args.state, args.county, args.city);
            }
            return Repos.Parcels.fetchParcelsCount(args.query, cityId);
        },
        parcelFavorites: async function (_: any, args: {}, context: CallContext) {
            if (!context.uid) {
                return [];
            }
            return Repos.Parcels.fetchFavorites(context.uid);
        },
        parcelFavoritesCount: async function (_: any, args: {}, context: CallContext) {
            if (!context.uid) {
                return 0;
            }
            return Repos.Parcels.fetchFavoritesCount(context.uid);
        },
        searchParcels: withAuth<{ query: string }>(async (args) => {
            let hits = await ElasticClient.search({
                index: 'parcels',
                type: 'parcel',
                size: 10,
                from: 0,
                body: {
                    query: {
                        bool: {
                            should: [
                                // Lot ID matcher
                                { term: { 'displayId': { value: args.query, boost: 4.0 } } },
                                { term: { 'searchId': { value: args.query, boost: 3.0 } } },
                                { prefix: { 'displayId': { value: args.query, boost: 2.0 } } },
                                { prefix: { 'searchId': { value: args.query, boost: 1.0 } } },

                                // Address Matcher
                                { match: { 'addressRaw': { query: args.query, operator: 'and' } } },
                            ]
                        }
                    },
                    highlight: {
                        fields: {
                            displayId: {},
                            addressRaw: {}
                        }
                    }
                }
            });
            return DB.Lot.findAll({ where: { id: { $in: hits.hits.hits.map((v) => v._id) } } });
        })
    },
    Mutation: {
        importParcels: async function (_: any, args: { state: string, county: string, city: string, parcels: ParcelInput[] }) {
            let cityId = await Repos.Area.resolveCity(args.state, args.county, args.city);
            await Repos.Parcels.applyParcels(cityId, args.parcels);
            return 'ok';
        },
        importBlocks: async function (_: any, args: { state: string, county: string, city: string, blocks: BlockInput[] }) {
            let cityId = await Repos.Area.resolveCity(args.state, args.county, args.city);
            await Repos.Blocks.applyBlocks(cityId, args.blocks);
            return 'ok';
        },
        parcelAlterMetadata: withPermission<{ id: string, data: { description?: string | null, currentUse?: string | null, available?: boolean | null, isOkForTower?: boolean | null } }>(['super-admin', 'editor'], async (args) => {
            return Repos.Parcels.applyMetadata((await Repos.Parcels.fetchParcelByRawMapId(args.id))!!.id!!, args.data);
        }),
        likeParcel: async function (_: any, args: { id: string }, context: CallContext) {
            if (!context.uid) {
                throw new UserError(ErrorText.permissionAuthenticatoinRequired);
            }
            let lot = (await Repos.Parcels.fetchParcelByRawMapId(args.id));
            if (!lot) {
                throw new NotFoundError(ErrorText.unableToFindParcel);
            }
            await lot.addLike(context.uid);
            (lot as any).changed('updatedAt', true);
            await lot.save();
            return lot;
        },
        unlikeParcel: async function (_: any, args: { id: string }, context: CallContext) {
            if (!context.uid) {
                throw new UserError(ErrorText.permissionAuthenticatoinRequired);
            }
            let lot = await Repos.Parcels.fetchParcelByRawMapId(args.id);
            if (!lot) {
                throw new NotFoundError(ErrorText.unableToFindParcel);
            }
            await lot.removeLike(context.uid);
            (lot as any).changed('updatedAt', true);
            await lot.save();
            return lot;
        },
        alphaSetNote: withAccount<{ parcelId: string, notes: string }>(async (args, uid, orgId) => {
            let lotId = (await Repos.Parcels.fetchParcelByRawMapId(args.parcelId))!!.id!!;
            await Repos.Parcels.setNotes(orgId, lotId, args.notes);
            return Repos.Parcels.fetchParcel(lotId);
        })
    },
    SearchResult: {
        parcels: async function (query: { query: string }) {
            let hits = await ElasticClient.search({
                index: 'parcels',
                type: 'parcel',
                size: 10,
                from: 0,
                body: {
                    query: {
                        bool: {
                            should: [
                                // Address Matcher
                                { match: { 'addressRaw': { query: query.query, operator: 'and' } } },

                                // Lot ID matcher
                                { term: { 'displayId': { value: query.query, boost: 4.0 } } },
                                { term: { 'searchId': { value: query.query, boost: 3.0 } } },
                                { prefix: { 'displayId': { value: query.query, boost: 2.0 } } },
                                { prefix: { 'searchId': { value: query.query, boost: 1.0 } } },
                            ]
                        }
                    },
                    highlight: {
                        fields: {
                            displayId: {},
                            addressRaw: {}
                        }
                    }
                }
            });

            let edges = [];

            for (let hit of hits.hits.hits) {
                console.warn(hit.highlight);
                let lt = await DB.Lot.findById(parseInt(hit._id, 10));
                if (lt) {
                    let highlights = [];
                    if (hit.highlight) {
                        if (hit.highlight.displayId) {
                            highlights.push({ key: 'title', match: hit.highlight.displayId });
                        }
                        if (hit.highlight.addressRaw) {
                            if (typeof hit.highlight.addressRaw === 'string') {
                                highlights.push({ key: 'address', match: hit.highlight.addressRaw });
                            } else {
                                highlights.push({ key: 'address', match: hit.highlight.addressRaw[0] });
                            }
                        }
                    }
                    edges.push({
                        score: hit._score,
                        highlight: highlights,
                        node: lt
                    });
                }
            }

            return {
                edges,
                total: hits.hits.total
            };
        }
    }
};