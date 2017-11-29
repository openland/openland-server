import { Context } from "./Context";
import { DB } from "../tables/index";

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
        }
    }
}