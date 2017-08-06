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
            return await DB.City.findAll({
                where: {
                    activated: true
                }
            }).map((city: { id: number, name: string, slug: string }) => { return { id: city.slug, name: city.name } })
        },
        city: async function (_: any, args: { id: string }) {
            var res = await DB.City.find({
                where: {
                    slug: args.id,
                    activated: true
                }
            })
            if (res != null){
                return {
                    id: res.slug,
                    name: res.name
                }
            } else {
                return null
            }
        }
    }
}