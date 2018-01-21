import { CallContext } from './CallContext';
import { ElasticClient } from '../indexing/index';
import { DB } from '../tables/index';
import { applyParcels } from '../repositories/Parcels';
import { GeoEnvelope } from './Core';
import { Lot } from '../tables/Lot';

export const Schema = `

    type Parcel {
        id: ID!
        title: String!
        geometry: [[Geo!]!]!
    }

    input ParcelInput {
        blockId: String!
        lotId: String!
        geometry: [[GeoInput!]!]!
    }

    extend type Query {
        parcels(envelope: GeoEnvelope!): [Parcel!]!
    }

    extend type Mutation {
        importParcels(state: String!, county: String!, city: String!, parcels: [ParcelInput!]!): String!
    }
`;

interface ParcelInput {
    blockId: string;
    lotId: string;
    geometry: { latitude: number, longitude: number }[][];
}

export const Resolver = {
    Parcel: {
        id: (src: Lot) => src.id,
        title: (src: Lot) => src.block!!.blockId + '|' + src.lotId,
        geometry: (src: Lot) => src.geometry!!.polygons.map((v) => v.coordinates)
    },
    Query: {
        parcels: async function (_: any, args: { envelope: GeoEnvelope }, context: CallContext) {
            let res = await ElasticClient.search<{ geometry: { coordinates: number[][][][], type: string } }>({
                index: 'parcels',
                type: 'parcel',
                size: 500,
                body: {
                    query: {
                        bool: {
                            must: {
                                match_all: {}
                            },
                            filter: {
                                geo_shape: {
                                    geometry: {
                                        shape: {
                                            type: 'envelope',
                                            coordinates: [
                                                [
                                                    args.envelope.leftTop.latitude,
                                                    args.envelope.leftTop.longitude
                                                ],
                                                [
                                                    args.envelope.rightBottom.latitude,
                                                    args.envelope.rightBottom.longitude
                                                ]
                                            ]
                                        },
                                        'relation': 'within'
                                    }
                                }
                            }
                        }
                    }
                }
            });

            return DB.Lot.findAll({
                where: {
                    id: {
                        $in: res.hits.hits.map((v) => v._id)
                    }
                },
                include: [{
                    model: DB.Block,
                    as: 'block'
                }]
            });
            // res.hits.hits.map((v) => v._id);

            // let response = res.hits.hits.filter((v) => v._source.geometry.type === 'multipolygon').map((v) => ({
            //     id: v._id,
            //     title: v._id,
            //     geometry: v._source.geometry.coordinates[0].map((c1) => c1.map((c2) => ({ latitude: c2[1], longitude: c2[0] })))
            // }));

            // console.warn(response);

            // return response;
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
        }
    }
};