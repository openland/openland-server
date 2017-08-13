import { DB } from '../tables'

export const Schema = `
    type Project {
        id: ID!
        name: String!
    }

    type AdminProject {
        id: ID!
        name: String!
        activated: Boolean!
    }

    extend type Account {
        projects: [Project!]
        project(id: ID!): Project
    }

    extend type Query {
        adminProjects(city: ID!): [AdminProject!]
    }
`


export const Resolver = {

    Query: {
        adminProjects: async function (obj: any, args: { city: string }) {
            var city = (await DB.Account.findOne({
                where: {
                    slug: args.city
                }
            }))!!
            return (await DB.Project.findAll({
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

    Account: {
        projects: async function (city: { _dbid: number }) {
            return (await DB.Project.findAll({
                where: {
                    city: city._dbid,
                    activated: true
                }
            })).map((project) => {
                return {
                    _dbid: project.id,
                    id: project.slug,
                    name: project.name
                }
            })
        },
        project: async function (city: { _dbid: number }, args: { id: string }) {
            var res = await DB.Project.find({
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