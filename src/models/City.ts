import { DB } from '../tables'

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
            return await DB.City.findAll({
                where: {
                    activated: true
                }
            }).map((city: { id: number, name: string, slug: string }) => {
                return {
                    _dbid: city.id,
                    id: city.slug,
                    name: city.name
                }
            })
        },
        city: async function (_: any, args: { id: string }) {
            var res = await DB.City.find({
                where: {
                    slug: args.id,
                    activated: true
                }
            })
            if (res != null) {
                return {
                    _dbid: res.id,
                    id: res.slug,
                    name: res.name
                }
            } else {
                return null
            }
        }
    }
}