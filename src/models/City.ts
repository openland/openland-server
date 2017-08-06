import { DB } from '../tables'
export interface City {
    id: string;
    name: string;
}
export const Schema = `
    type City {
        id: ID!
        name: String!
    }
    extend type Query {
        city(id: ID!): City
        cities: [City]
    }
`

export const Resolver = {
    Query: {
        cities: async function () {
            return await DB.City.findAll()
        }
    }
}