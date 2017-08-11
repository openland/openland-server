import { DB } from '../tables'

export const Schema = `
    type Segment {
        id: ID!
        name: String!
    }

    type AdminProject {
        id: ID!
        name: String!
        activated: Boolean!
    }

    extend type City {
        segments: [Segment]
        segment(id: ID!): Segment
    }

    extend type Query {
        adminProjects(city: ID!): [AdminProject!]
    }
`


export const Resolver = {

    Query: {
        adminProjects: async function (obj: any, args: { id: string }) {
            var city = (await DB.City.findOne({
                where: {
                    slug: args.id
                }
            }))!!
            return (await DB.Segment.findAll({
                where: {
                    city: city.id
                }
            })).map((src) => {
                return {
                    id: src.slug,
                    name: src.name,
                    activated: src.activated
                }
            })
        }
    },

    City: {
        segments: async function (city: { _dbid: number }) {
            return await DB.Segment.findAll({
                where: {
                    city: city._dbid,
                    activated: true
                }
            }).map((segment: { id: number, name: string, slug: string }) => {
                return {
                    _dbid: segment.id,
                    id: segment.slug,
                    name: segment.name
                }
            })
        },
        segment: async function (city: { _dbid: number }, args: { id: string }) {
            var res = await DB.Segment.find({
                where: {
                    city: city._dbid,
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