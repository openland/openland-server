import { CallContext } from './CallContext';
import { ElasticClient } from '../indexing/index';

export const Schema = `

    type Parcel {
        id: ID!
        title: String!
        geometry: [[Geo!]!]!
    }

    extend type Query {
        parcels: [Parcel!]!
    }
`;

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
    }
};