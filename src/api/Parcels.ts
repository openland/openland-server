import { Lot } from '../tables/Lot';
import { Block } from '../tables/Block';
import { Repos } from '../repositories/index';
import { ExtrasInput } from './Core';
import { DB } from '../tables';
import { buildId, parseId } from '../utils/ids';

export const Schema = `

    type Parcel {
        id: ID!
        title: String!
        geometry: String
        extrasArea: Int
        extrasZoning: [String!]
        extrasSupervisorDistrict: String
        block: Block!
    }

    input ParcelInput {
        id: String!
        blockId: String!
        geometry: [[[Float!]!]!]
        extras: ExtrasInput
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
        blocksConnection(state: String!, county: String!, city: String!, filter: String, first: Int!, after: String, page: Int): BlockConnection!
        block(id: ID!): Block!
        parcelsConnection(state: String!, county: String!, city: String!, filter: String, first: Int!, after: String, page: Int): ParcelConnection!
        parcel(id: ID!): Parcel!
    }

    extend type Mutation {
        importParcels(state: String!, county: String!, city: String!, parcels: [ParcelInput!]!): String!
        importBlocks(state: String!, county: String!, city: String!, blocks: [BlockInput!]!): String!
    }
`;

interface ParcelInput {
    id: string;
    blockId: string;
    geometry?: number[][][] | null;
    extras?: ExtrasInput | null;
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
        block: (src: Lot) => Repos.Blocks.fetchBlock(src.blockId!!),
        extrasArea: (src: Lot) => (src.extras && src.extras.area) ? Math.round(src.extras.area as number) : null,
        extrasZoning: (src: Lot) => Repos.Blocks.fetchBlock(src.blockId!!),
        extrasSupervisorDistrict: (src: Lot) => src.extras ? src.extras.zoning : null
    },
    Block: {
        id: (src: Block) => buildId(src.id!!, 'Block'),
        title: (src: Block) => (src.extras && src.extras.displayId) ? src.extras.displayId : src.blockId,
        geometry: (src: Block) => src.geometry ? JSON.stringify(src.geometry!!.polygons.map((v) => v.coordinates.map((c) => [c.longitude, c.latitude]))) : null,
        parcels: (src: Block) => DB.Lot.findAll({ where: { blockId: src.id!! } }),
        extrasArea: (src: Block) => (src.extras && src.extras.area) ? Math.round(src.extras.area as number) : null,
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
        parcelsConnection: async function (_: any, args: { state: string, county: string, city: string, filter?: string, first: number, after?: string, page?: number }) {
            let cityId = await Repos.Area.resolveCity(args.state, args.county, args.city);
            return await Repos.Parcels.fetchParcels(cityId, args.first, args.filter, args.after, args.page);
        },
        parcel: async function (_: any, args: { id: string }) {
            return Repos.Parcels.fetchParcel(parseId(args.id, 'Parcel'));
        },
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
        }
    }
};