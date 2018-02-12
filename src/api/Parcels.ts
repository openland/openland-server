import { CallContext } from './CallContext';
import { ElasticClient } from '../indexing/index';
import { DB } from '../tables/index';
import { applyParcels } from '../repositories/Parcels';
import { GeoEnvelope, ExtrasInput, GeoInputShort } from './Core';
import { Lot } from '../tables/Lot';
import { currentTime, printElapsed } from '../utils/timer';
import { Block } from '../tables/Block';
import { Repos } from '../repositories/index';
import { SelectBuilder } from '../utils/SelectBuilder';

export const Schema = `

    type Parcel {
        id: ID!
        title: String!
        geometry: String!
    }

    type Block {
        id: ID!
        title: String!
        geometry: String
        extrasArea: Int
        extrasSupervisorDistrict: String
    }

    input ParcelInput {
        blockId: String!
        lotId: String!
        geometry: [[GeoInputShort!]!]
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
        parcels(envelope: GeoEnvelope!): [Parcel!]!
        blocksMap(envelope: GeoEnvelope!): [Block!]!

        blocksConnection(state: String!, county: String!, city: String!, filter: String, first: Int!, after: String, page: Int): BlockConnection!
        block(id: ID!): Block!
    }

    extend type Mutation {
        importParcels(state: String!, county: String!, city: String!, parcels: [ParcelInput!]!): String!
        importBlocks(state: String!, county: String!, city: String!, blocks: [BlockInput!]!): String!
    }
`;

interface ParcelInput {
    blockId: string;
    lotId: string;
    geometry: GeoInputShort[][];
}

interface BlockInput {
    id: string;
    geometry?: number[][][] | null;
    extras?: ExtrasInput | null;
}

export const Resolver = {
    Parcel: {
        id: (src: Lot) => src.id,
        title: (src: Lot) => (src as any)['block.blockId'] + '|' + src.lotId,
        geometry: (src: Lot) => JSON.stringify(src.geometry!!.polygons.map((v) => v.coordinates.map((c) => [c.longitude, c.latitude])))
    },
    Block: {
        id: (src: Block) => src.id,
        title: (src: Block) => (src.extras && src.extras.displayId) ? src.extras.displayId : src.id,
        geometry: (src: Block) => src.geometry ? JSON.stringify(src.geometry!!.polygons.map((v) => v.coordinates.map((c) => [c.longitude, c.latitude]))) : null,
        extrasArea: (src: Block) => (src.extras && src.extras.area) ? Math.round(src.extras.area as number) : null,
        extrasSupervisorDistrict: (src: Block) => src.extras ? src.extras.supervisor_id : null
    },
    Query: {
        parcels: async function (_: any, args: { envelope: GeoEnvelope }, context: CallContext) {
            let start = currentTime();
            let res = await ElasticClient.search<{ geometry: { coordinates: number[][][][], type: string } }>({
                index: 'parcels',
                type: 'parcel',
                size: 3000,
                body: {
                    query: {
                        geo_shape: {
                            geometry: {
                                shape: {
                                    type: 'envelope',
                                    coordinates: [
                                        [
                                            args.envelope.leftTop.longitude,
                                            args.envelope.leftTop.latitude,
                                        ],
                                        [
                                            args.envelope.rightBottom.longitude,
                                            args.envelope.rightBottom.latitude
                                        ]
                                    ]
                                },
                                'relation': 'intersects'
                            }
                        }
                    }
                }
            });

            printElapsed('searched', start);

            return DB.Lot.findAll({
                where: {
                    id: {
                        $in: res.hits.hits.map((v) => v._id)
                    }
                },
                include: [{
                    model: DB.Block,
                    as: 'block'
                }],
                raw: true
            });
        },
        blocksConnection: async function (_: any, args: { state: string, county: string, city: string, filter?: string, first: number, after?: string, page?: number }) {
            let cityId = await Repos.Area.resolveCity(args.state, args.county, args.city);
            let builder = new SelectBuilder(DB.Block)
                .whereEq('cityId', cityId)
                .after(args.after)
                .page(args.page)
                .limit(args.first);
            return builder.findAll();
        },
        block: async function (_: any, args: { id: string }) {
            return DB.Block.findById(args.id);
        },
        blocksMap: async function (_: any, args: { envelope: GeoEnvelope }, context: CallContext) {
            let start = currentTime();
            let res = await ElasticClient.search<{ geometry: { coordinates: number[][][][], type: string } }>({
                index: 'blocks',
                type: 'block',
                size: 3000,
                body: {
                    query: {
                        geo_shape: {
                            geometry: {
                                shape: {
                                    type: 'envelope',
                                    coordinates: [
                                        [
                                            args.envelope.leftTop.longitude,
                                            args.envelope.leftTop.latitude,
                                        ],
                                        [
                                            args.envelope.rightBottom.longitude,
                                            args.envelope.rightBottom.latitude
                                        ]
                                    ]
                                },
                                'relation': 'intersects'
                            }
                        }
                    }
                }
            });

            printElapsed('searched', start);

            return DB.Block.findAll({
                where: {
                    id: {
                        $in: res.hits.hits.map((v) => v._id)
                    }
                },
                raw: true
            });
        }
    },
    Mutation: {
        importParcels: async function (_: any, args: { state: string, county: string, city: string, parcels: ParcelInput[] }) {
            let city = await DB.City.findOne({
                where: {
                    name: args.city
                },
                include: [{
                    model: DB.County,
                    as: 'county',
                    where: {
                        name: args.county
                    },
                    include: [{
                        model: DB.State,
                        as: 'state',
                        where: {
                            code: args.state
                        }
                    }]
                }]
            });
            if (!city) {
                throw 'City is not found for ' + args.state + ', ' + args.county + ', ' + args.city;
            }
            await applyParcels(city.id!!, args.parcels);
            return 'ok';
        },
        importBlocks: async function (_: any, args: { state: string, county: string, city: string, blocks: BlockInput[] }) {
            let cityId = await Repos.Area.resolveCity(args.state, args.county, args.city);
            await Repos.Blocks.applyBlocks(cityId, args.blocks);
            return 'ok';
        }
    }
};