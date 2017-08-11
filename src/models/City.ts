import { DB } from '../tables'

export const Schema = `
    type City {
        id: ID!
        name: String!
    }

    type AdminCity {
        id: ID!
        name: String!
        activated: Boolean!
    }

    extend type Query {
        city(id: ID!): City
        cities: [City]

        adminCities: [AdminCity]
    }

    extend type Mutation {
        adminCreateCity(id: ID!, name: String!): AdminCity
        adminAlterCity(id: ID!, name: String, activated: Boolean): AdminCity
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
        adminCities: async function () {
            return await DB.City.findAll().map((city: { id: number, name: string, slug: string, activated: boolean }) => {
                return {
                    _dbid: city.id,
                    id: city.slug,
                    name: city.name,
                    activated: city.activated
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
    },
    Mutation: {
        adminCreateCity: async function (_: any, args: { id: string, name: string }) {
            var res = await DB.City.create({
                slug: args.id,
                name: args.name
            });
            return {
                id: res.slug,
                name: res.name,
                activated: res.activated
            }
        },
        adminAlterCity: async function (_: any, args: { id: string, name?: string, activated?: boolean }) {
            var res = (await DB.City.findOne({
                where: {
                    slug: args.id
                }
            }))!!
            if (args.name != null) {
                res.name = args.name
            }
            if (args.activated != null) {
                res.activated = args.activated
            }
            res.save()
            return {
                id: res.slug,
                name: res.name,
                activated: res.activated
            }
        }
    }
}