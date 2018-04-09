import { Lot } from '../tables/Lot';
import { Block } from '../tables/Block';
import { Repos } from '../repositories/index';
import { ExtrasInput } from './Core';
import { DB } from '../tables';
import { ElasticClient } from '../indexing';
import * as Turf from '@turf/turf';
import { CallContext } from './CallContext';
import { withPermission, withAuth, withPermissionOptional, withAccountTypeOptional } from './utils/Resolvers';
import { IDs } from './utils/IDs';
import { serializeGeometry } from './utils/Serializers';
import { createRectangle } from '../utils/map';
import { normalizeCapitalized } from '../modules/Normalizer';

interface ParcelInput {
    id: string;
    blockId?: string | null;
    geometry?: number[][][][] | null;
    extras?: ExtrasInput | null;
    addresses?: {
        streetName: string,
        streetNameSuffix?: string | null
        streetNumber: number,
        streetNumberSuffix?: string | null
    }[];
    retired?: boolean;
}

interface BlockInput {
    id: string;
    geometry?: number[][][][] | null;
    extras?: ExtrasInput | null;
}

export const Resolver = {
    Parcel: {
        id: (src: Lot) => IDs.Parcel.serialize(src.id!!),
        title: (src: Lot) => {
            if (src.extras && src.extras.displayId) {
                return src.extras.displayId;
            } else if (src.primaryParcelId) {
                return DB.ParcelID.findById(src.primaryParcelId);
            } else {
                return src.lotId;
            }
        },
        geometry: (src: Lot) => serializeGeometry(src.geometry),
        center: (src: Lot) => {
            if (src.geometry) {
                let ctr = Turf.centerOfMass({ type: 'MultiPolygon', coordinates: src.geometry.polygons.map((v) => [v.coordinates.map((v2) => [v2.longitude, v2.latitude])]) });
                return { longitude: ctr.geometry!!.coordinates[0], latitude: ctr.geometry!!.coordinates[1] };
            }
            return null;
        },
        block: (src: Lot) => src.blockId ? Repos.Blocks.fetchBlock(src.blockId!!) : null,

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

        extrasArea: (src: Lot) => (src.extras && src.extras.area) ? Math.round(src.extras.area as number) : null,

        extrasAssessorArea: (src: Lot) => (src.extras && src.extras.assessor_front) ? Math.round(src.extras.assessor_area as number) : null,
        extrasAssessorFront: (src: Lot) => (src.extras && src.extras.assessor_front) ? Math.round(src.extras.assessor_front as number) : null,
        extrasAssessorDepth: (src: Lot) => (src.extras && src.extras.assessor_front) ? Math.round(src.extras.assessor_depth as number) : null,

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
        extrasAddress: (src: Lot) => src.extras ? src.extras.address ? normalizeCapitalized(src.extras.address.toString()) : null : null,
        extrasOwnerName: (src: Lot) => src.extras ? src.extras.owner_name : null,
        extrasOwnerType: (src: Lot) => src.extras ? src.extras.owner_type : null,
        extrasShapeType: (src: Lot) => src.extras ? src.extras.shape_type : null,
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
        })
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
            return Repos.Parcels.fetchParcel(IDs.Parcel.parse(args.id));
        },
        parcelsOverlay: async function (_: any, args: { box: { south: number, north: number, east: number, west: number }, limit: number, query?: string | null }) {
            return Repos.Parcels.fetchGeoParcels(args.box, args.limit, args.query);
        },
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
        parcelAlterMetadata: withPermission<{ id: string, data: { description?: string | null, currentUse?: string | null, available?: boolean | null, isOkForTower?: boolean | null } }>(['super-admin', 'editor'], (args) => {
            return Repos.Parcels.applyMetadata(IDs.Parcel.parse(args.id), args.data);
        }),
        likeParcel: async function (_: any, args: { id: string }, context: CallContext) {
            if (!context.uid) {
                throw Error('Authentication is required');
            }
            let lot = await Repos.Parcels.fetchParcel(IDs.Parcel.parse(args.id));
            if (!lot) {
                throw Error('Unable to find Lot');
            }
            await lot.addLike(context.uid);
            (lot as any).changed('updatedAt', true);
            await lot.save();
            return lot;
        },
        unlikeParcel: async function (_: any, args: { id: string }, context: CallContext) {
            if (!context.uid) {
                throw Error('Authentication is required');
            }
            let lot = await Repos.Parcels.fetchParcel(IDs.Parcel.parse(args.id));
            if (!lot) {
                throw Error('Unable to find Lot');
            }
            await lot.removeLike(context.uid);
            (lot as any).changed('updatedAt', true);
            await lot.save();
            return lot;
        }
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