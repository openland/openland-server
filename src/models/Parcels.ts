import { CallContext } from './CallContext';
import { ElasticClient } from '../indexing/index';
import { DB } from '../tables/index';
import { applyParcels } from '../repositories/Parcels';

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
        parcels: [Parcel!]!
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
    Query: {
        parcels: async function (_: any, args: {}, context: CallContext) {
            let res = await ElasticClient.search<{ location: { coordinates: number[][][], type: string } }>({
                index: 'parcels',
                type: 'parcel',
                body: {
                    query: {
                        match_all: {}
                    }
                }
            });

            let response = res.hits.hits.filter((v) => v._source.location.type === 'Polygon').map((v) => ({
                id: v._id,
                title: v._id,
                geometry: v._source.location.coordinates.map((c1) => c1.map((c2) => ({ latitude: c2[1], longitude: c2[0] })))
            }));

            return response;
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