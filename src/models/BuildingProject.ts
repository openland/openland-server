import { Context } from "./Context";
import { DB } from "../tables/index";
import { BuildingProject } from "../tables/BuildingProject";

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

    extend type Query {
        buildingProjects(filter: String, first: Int!, after: String): BuildingProjectConnection!
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
        permits: []
    },
    Query: {
        buildingProjects: async function (_: any, args: { first: number }, context: Context) {
            let res = await DB.BuidlingProject.findAndCountAll({
                where: {
                    account: context.accountId
                },
                limit: args.first
            })
            return {
                edges: res.rows.map((p) => {
                    return {
                        node: p,
                        cursor: p.id
                    }
                }),
                pageInfo: {
                    hasNextPage: res.count > res.rows.length,
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