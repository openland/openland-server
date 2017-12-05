import { Context } from "./Context";
import { DB } from "../tables/index";
import { BuildingProject } from "../tables/BuildingProject";
import { resolveStreetView, resolvePicture } from "../utils/pictures";
import { textLikeFields } from "../utils/db_utils";

export const Schema = `
    type BuildingProject {
        id: ID!
        name: String!
        description: String
        status: String
        startedAt: String
        completedAt: String
        expectedCompletedAt: String
        verified: Boolean!

        existingUnits: Int
        proposedUnits: Int
        existingAffordableUnits: Int
        proposedAffordableUnits: Int

        picture(height: Int, width: Int): String
        
        extrasDeveloper: String
        extrasGeneralConstructor: String
        extrasYearEnd: String
        extrasAddress: String
        extrasAddressSecondary: String
        extrasPermit: String
        extrasComment: String
        extrasUrl: String

        permits: [Permit!]!
    }

    type BuildingProjectEdge {
        node: BuildingProject!
        cursor: String!
    }

    type BuildingProjectConnection {
        edges: [BuildingProjectEdge!]!
        pageInfo: PageInfo!
    }

    type BuildingProjectStats {
        projectsTracked: Int!
        projectsVerified: Int!
        year2017NewUnits: Int!
        year2017NewUnitsVerified: Int!
        year2018NewUnits: Int!
        year2018NewUnitsVerified: Int!
    }

    extend type Query {
        buildingProjects(filter: String, minUnits: Int, year: String, first: Int!, after: String): BuildingProjectConnection!
        buildingProjectsStats: BuildingProjectStats!
    }

    input BuildingProjectInput {
        id: ID!
        name: String
        description: String
        verified: Boolean

        existingUnits: Int
        proposedUnits: Int
        existingAffordableUnits: Int
        proposedAffordableUnits: Int
        
        permits: [ID!]
    }
    

    extend type Mutation {
        updateBuildingProjects(projects: [BuildingProjectInput!]!, overwrite: Boolean): String!
        updateBuildingProjectsSync(key: String, database: String): String!
    }
`

interface BuildingProjectInput {
    id: string
    name?: string
    description?: string
    verified?: boolean

    existingUnits?: number
    proposedUnits?: number
    existingAffordableUnits?: number
    proposedAffordableUnits?: number
}

export const Resolver = {
    BuildingProject: {
        id: (src: BuildingProject) => src.projectId,
        name: (src: BuildingProject) => src.name,
        description: (src: BuildingProject) => src.description,
        status: (src: BuildingProject) => src.status,
        startedAt: (src: BuildingProject) => src.projectStartedAt,
        completedAt: (src: BuildingProject) => src.projectCompletedAt,
        expectedCompletedAt: (src: BuildingProject) => src.projectExpectedCompletedAt,
        verified: (src: BuildingProject) => src.verified,

        existingUnits: (src: BuildingProject) => src.existingUnits,
        proposedUnits: (src: BuildingProject) => src.proposedUnits,
        existingAffordableUnits: (src: BuildingProject) => src.existingAffordableUnits,
        proposedAffordableUnits: (src: BuildingProject) => src.proposedAffordableUnits,
        permits: [],

        picture: (src: BuildingProject, args: { height?: number, width?: number }, context: Context) => {
            if (src.picture) {
                return resolvePicture(context, src.picture, args.height, args.width)
            } else {
                if (args.height && args.width) {
                    return resolveStreetView(context, src.extrasAddress!!, args.height, args.width)
                } else {
                    return null
                }
            }
        },

        extrasDeveloper: (src: BuildingProject) => src.extrasDeveloper,
        extrasGeneralConstructor: (src: BuildingProject) => src.extrasGeneralConstructor,
        extrasYearEnd: (src: BuildingProject) => src.extrasYearEnd,
        extrasAddress: (src: BuildingProject) => src.extrasAddress,
        extrasAddressSecondary: (src: BuildingProject) => src.extrasAddressSecondary,
        extrasPermit: (src: BuildingProject) => src.extrasPermit,
        extrasComment: (src: BuildingProject) => src.extrasComment,
        extrasUrl: (src: BuildingProject) => src.extrasUrl
    },
    Query: {
        buildingProjectsStats: async function (_: any, args: {}, context: Context) {
            let projectsTracked = DB.BuidlingProject.count()
            let projectsVerified = DB.BuidlingProject.count({
                where: { verified: true }
            })
            let year2017NewUnits = DB.BuidlingProject.sum('proposedUnits', {
                where: { extrasYearEnd: "2017" }
            })
            let year2017NewUnitsVerified = DB.BuidlingProject.sum('proposedUnits', {
                where: { extrasYearEnd: "2017", verified: true }
            })
            let year2018NewUnits = DB.BuidlingProject.sum('proposedUnits', {
                where: { extrasYearEnd: "2018" }
            })
            let year2018NewUnitsVerified = DB.BuidlingProject.sum('proposedUnits', {
                where: { extrasYearEnd: "2018", verified: true }
            })
            return {
                projectsTracked: await projectsTracked,
                projectsVerified: await projectsVerified,
                year2017NewUnits: await year2017NewUnits,
                year2017NewUnitsVerified: await year2017NewUnitsVerified,
                year2018NewUnits: await year2018NewUnits,
                year2018NewUnitsVerified: await year2018NewUnitsVerified,
            }
        },
        buildingProjects: async function (_: any, args: { first: number, minUnits?: number, year?: string, filter?: string, after?: string }, context: Context) {
            var offset: number = 0
            if (args.after) {
                offset = parseInt(args.after)
            }
            var where: any = {
                account: context.accountId
            }
            if (args.minUnits) {
                where['proposedUnits'] = DB.connection.literal('"proposedUnits"-"existingUnits" >= ' + args.minUnits)
                // where = {
                //     account: context.accountId,
                //     proposedUnits: DB.connection.literal('"proposedUnits"-"existingUnits" >= '+args.minUnits)
                // }
            }
            if (args.year) {
                where['extrasYearEnd'] = args.year
            }
            if (args.filter && args.filter !== '') {
                where['@@'] = textLikeFields(DB.BuidlingProject, args.filter, ["name", "extrasAddress", "extrasAddressSecondary"])
                //  {
                //     $like: args.filter + '%'
                // }
            }
            let res = await DB.BuidlingProject.findAndCountAll({
                where: where,
                order: [DB.connection.literal('"proposedUnits"-"existingUnits" DESC'), 'id'],
                //order: [DB.connection.fn('SUM', DB.connection.col('proposedUnits'), DB.connection.col('existingUnits')), 'ASC'],
                limit: args.first + offset,
                offset: offset
            })
            return {
                edges: res.rows.map((p, i) => {
                    return {
                        node: p,
                        cursor: (i + 1 + offset).toString() //(p.proposedUnits!! - p.existingUnits!!) + "-" + p.id
                    }
                }),
                pageInfo: {
                    hasNextPage: res.rows.length == args.first,
                    hasPreviousPage: false
                }
            }
        }
    },
    Mutation: {
        updateBuildingProjects: async function (_: any, args: { projects: BuildingProjectInput[], overwrite?: boolean }, context: Context) {
            await DB.tx(async (tx) => {
                if (args.overwrite) {
                    await DB.BuidlingProject.destroy({
                        where: {
                            account: context.accountId
                        }
                    })
                }
                for (let p of args.projects) {
                    let existing = await DB.BuidlingProject.findOne({
                        where: {
                            account: context.accountId,
                            projectId: p.id
                        }
                    })
                    if (!existing) {
                        await DB.BuidlingProject.create({
                            projectId: p.id,
                            name: p.name,
                            verified: p.verified,
                            description: p.description,
                            existingUnits: p.existingUnits,
                            proposedUnits: p.proposedUnits,
                            existingAffordableUnits: p.existingAffordableUnits,
                            proposedAffordableUnits: p.proposedAffordableUnits
                        })
                    } else {
                        if (p.name) {
                            existing.name = p.name
                        }
                        if (p.description) {
                            existing.description = p.description
                        }
                        if (p.verified) {
                            existing.verified = p.verified
                        }
                        if (p.existingUnits) {
                            existing.existingUnits = p.existingUnits
                        }
                        if (p.proposedUnits) {
                            existing.proposedUnits = p.proposedUnits
                        }
                        if (p.existingAffordableUnits) {
                            existing.existingAffordableUnits = p.existingAffordableUnits
                        }
                        if (p.proposedAffordableUnits) {
                            existing.proposedAffordableUnits = p.proposedAffordableUnits
                        }
                        await existing.save()
                    }
                }
            });
            return "ok"
        },
        updateBuildingProjectsSync: async function (_: any, args: { key?: string, database?: string }, context: Context) {
            context.requireWriteAccess()
            if (args.key && args.database) {
                await DB.AirTable.upsert({
                    account: context.accountId,
                    airtableDatabase: args.database,
                    airtableKey: args.key
                })
            } else {
                await DB.AirTable.destroy({
                    where: {
                        account: context.accountId
                    }
                })
            }
            return "ok"
        }
    }
}