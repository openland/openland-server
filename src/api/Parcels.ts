import { Lot } from '../tables/Lot';
import { Block } from '../tables/Block';
import { Repos } from '../repositories/index';
import { ExtrasInput } from './Core';
import { DB } from '../tables';
import { buildId, parseId } from '../utils/ids';
import { ElasticClient } from '../indexing';
import * as Turf from '@turf/turf';

export const Schema = `

    type Parcel {
        id: ID!
        title: String!
        geometry: String
        center: Geo
        block: Block!

        addresses: [StreetNumber!]!

        extrasArea: Int
        extrasZoning: [String!]
        extrasSupervisorDistrict: String
        extrasLandValue: Int
        extrasImprovementValue: Int
        extrasPropertyValue: Int
        extrasFixturesValue: Int

        extrasYear: Int

        extrasStories: Int
        extrasUnits: Int
        extrasRooms: Int
        extrasBathrooms: Int
        extrasBedrooms: Int
        extrasNeighborhood: String

        metadata: ParcelMetadata!
    }

    type ParcelMetadata {
        description: String
    }

    input ParcelMetadataInput {
        description: String
    }

    input ParcelInput {
        id: String!
        blockId: String
        geometry: [[[Float!]!]!]
        extras: ExtrasInput
        addresses: [StreetNumberInfo!]
    }

    type ParcelEdge {
        node: Parcel!
        cursor: String!
    }

    type ParcelConnection {
        edges: [ParcelEdge!]!
        pageInfo: PageInfo!
    }

    type Block {
        id: ID!
        title: String!
        geometry: String
        extrasArea: Int
        extrasZoning: [String!]
        extrasSupervisorDistrict: String
        parcels: [Parcel!]!
    }

    input BlockInput {
        id: String!
        geometry: [[[Float!]!]!]
        extras: ExtrasInput
    }

    type BlockEdge {
        node: Block!
        cursor: String!
    }

    type BlockConnection {
        edges: [BlockEdge!]!
        pageInfo: PageInfo!
    }

    extend type Query {
        block(id: ID!): Block!
        parcel(id: ID!): Parcel!

        blocksConnection(
            state: String!, county: String!, city: String!, 
            query: String, 
            first: Int!, after: String, page: Int
        ): BlockConnection!
        parcelsConnection(
            state: String!, county: String!, city: String!, 
            query: String, 
            first: Int!, after: String, page: Int
        ): ParcelConnection!

        parcelsOverlay(box: GeoBox!, limit: Int!, filterZoning: [String!], query: String): [Parcel!]
        blocksOverlay(box: GeoBox!, limit: Int!, filterZoning: [String!], query: String): [Block!]
    }

    extend type Mutation {
        importParcels(state: String!, county: String!, city: String!, parcels: [ParcelInput!]!): String!
        importBlocks(state: String!, county: String!, city: String!, blocks: [BlockInput!]!): String!
        
        parcelAlterMetadata(id: ID!, data: ParcelMetadataInput!): Parcel!
    }

    type ParcelSearchResult {
        edges: [ParcelResult!]!
        total: Int!
    }
    type ParcelResult {
        node: Parcel!
        score: Float!
    }

    extend type SearchResult {
        parcels: ParcelSearchResult!
    }
`;

interface ParcelInput {
    id: string;
    blockId?: string | null;
    geometry?: number[][][] | null;
    extras?: ExtrasInput | null;
    addresses?: {
        streetName: string,
        streetNameSuffix?: string | null
        streetNumber: number,
        streetNumberSuffix?: string | null
    }[];
}

interface BlockInput {
    id: string;
    geometry?: number[][][] | null;
    extras?: ExtrasInput | null;
}

export const Resolver = {
    Parcel: {
        id: (src: Lot) => buildId(src.id!!, 'Parcel'),
        title: (src: Lot) => (src.extras && src.extras.displayId) ? src.extras.displayId : src.lotId,
        geometry: (src: Lot) => src.geometry ? JSON.stringify(src.geometry!!.polygons.map((v) => v.coordinates.map((c) => [c.longitude, c.latitude]))) : null,
        center: (src: Lot) => {
            if (src.geometry) {
                let ctr = Turf.centerOfMass({ type: 'MultiPolygon', coordinates: src.geometry.polygons.map((v) => [v.coordinates.map((v2) => [v2.longitude, v2.latitude])]) });
                return { longitude: ctr.geometry!!.coordinates[0], latitude: ctr.geometry!!.coordinates[1] };
            }
            return null;
        },
        block: (src: Lot) => Repos.Blocks.fetchBlock(src.blockId!!),

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
                description: src.metadata!!.description
            };
        },

        extrasArea: (src: Lot) => (src.extras && src.extras.area) ? Math.round(src.extras.area as number) : null,
        extrasZoning: (src: Lot) => src.extras ? src.extras.zoning : null,
        extrasSupervisorDistrict: (src: Lot) => src.extras ? src.extras.supervisor_id : null,
        extrasLandValue: (src: Lot) => src.extras ? src.extras.land_value : null,
        extrasImprovementValue: (src: Lot) => src.extras ? src.extras.improvement_value : null,
        extrasPropertyValue: (src: Lot) => src.extras ? src.extras.personal_prop_value : null,
        extrasFixturesValue: (src: Lot) => src.extras ? src.extras.fixtures_value : null,
        extrasStories: (src: Lot) => src.extras ? src.extras.count_stories : null,
        extrasUnits: (src: Lot) => src.extras ? src.extras.count_units : null,
        extrasRooms: (src: Lot) => src.extras ? src.extras.count_rooms : null,
        extrasBathrooms: (src: Lot) => src.extras ? src.extras.count_bathrooms : null,
        extrasBedrooms: (src: Lot) => src.extras ? src.extras.count_bedrooms : null,
        extrasYear: (src: Lot) => src.extras ? src.extras.year_built : null,
        extrasNeighborhood: (src: Lot) => src.extras ? src.extras.neighbourhoods : null,
    },
    Block: {
        id: (src: Block) => buildId(src.id!!, 'Block'),
        title: (src: Block) => (src.extras && src.extras.displayId) ? src.extras.displayId : src.blockId,
        geometry: (src: Block) => src.geometry ? JSON.stringify(src.geometry!!.polygons.map((v) => v.coordinates.map((c) => [c.longitude, c.latitude]))) : null,
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
            return Repos.Blocks.fetchBlock(parseId(args.id, 'Block'));
        },
        blocksOverlay: async function (_: any, args: { box: { south: number, north: number, east: number, west: number }, limit: number, filterZoning?: string[] | null, query?: string | null }) {
            return Repos.Blocks.fetchGeoBlocks(args.box, args.limit, args.query);
        },
        parcelsConnection: async function (_: any, args: { state: string, county: string, city: string, query?: string, first: number, after?: string, page?: number }) {
            let cityId = await Repos.Area.resolveCity(args.state, args.county, args.city);
            return await Repos.Parcels.fetchParcelsConnection(cityId, args.first, args.query, args.after, args.page);
        },
        parcel: async function (_: any, args: { id: string }) {
            return Repos.Parcels.fetchParcel(parseId(args.id, 'Parcel'));
        },
        parcelsOverlay: async function (_: any, args: { box: { south: number, north: number, east: number, west: number }, limit: number, filterZoning?: string[] | null, query?: string | null }) {
            return Repos.Parcels.fetchGeoParcels(args.box, args.limit, args.query);
        }
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
        parcelAlterMetadata: async function (_: any, args: { id: string, data: { description?: string | null } }) {
            return Repos.Parcels.applyMetadata(parseId(args.id, 'Parcel'), args.data);
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
                                { match: { 'address': { query: query.query, operator: 'and' } } },
                                { prefix: { lotId: query.query } },
                                { term: { lotId: { value: query.query, boost: 3.0 } } },
                                { prefix: { 'displayId': { value: query.query, boost: 2.0 } } },
                                { term: { blockId: { value: query.query, boost: 0.5 } } }
                            ]
                        }
                    }
                }
            });

            let edges = [];

            for (let hit of hits.hits.hits) {
                let lt = await DB.Lot.findById(parseInt(hit._id, 10));
                if (lt) {
                    edges.push({
                        score: hit._score,
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