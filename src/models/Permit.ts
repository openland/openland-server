import { Context } from "./Context";
import { DB } from "../tables/index";
import { applyPermits } from "../repositories/Permits";
import { PermitStatus, Permit, PermitType } from "../tables/Permit";

export const Schema = `

    type Permit {
        id: ID!
        type: PermitType
        typeWood: Boolean
        status: PermitStatus
        statusUpdatedAt: String
        createdAt: String
        issuedAt: String
        completedAt: String
        expiredAt: String
        streetNumbers: [StreetNumber!]!

        existingStories: Int
        proposedStories: Int
        existingUnits: Int
        proposedUnits: Int
        existingAffordableUnits: Int
        proposedAffordableUnits: Int
        proposedUse: String
        description: String
    }

    enum PermitStatus {
        FILING
        FILED
        ISSUED 
        COMPLETED
        EXPIRED
        CANCELLED 
        DISAPPROVED 
        APPROVED 
        ISSUING
        REVOKED
        WITHDRAWN
        PLANCHECK
        SUSPENDED
        REINSTATED
        INSPECTING
        UPHELD
        INCOMPLETE
        GRANTED
        APPEAL
    }

    enum PermitType {
        NEW_CONSTRUCTION
        ADDITIONS_ALTERATIONS_REPARE
        OTC_ADDITIONS
        WALL_OR_PAINTED_SIGN
        SIGN_ERRECT
        DEMOLITIONS
        GRADE_QUARRY_FILL_EXCAVATE
    }

    type PermitEdge {
        node: Permit!
        cursor: String!
    }

    type PermitsConnection {
        edges: [PermitEdge!]!
        pageInfo: PageInfo!
    }

    extend type Query {
        permits(filter: String, first: Int!, after: String): PermitsConnection
        permit(id: ID!): Permit
    }

    input PermitInfo {
        id: ID!
        status: PermitStatus
        type: PermitType
        typeWood: Boolean
        statusUpdatedAt: String
        createdAt: String
        issuedAt: String
        completedAt: String
        expiredAt: String
        street: [StreetNumberInfo!]

        existingStories: Int
        proposedStories: Int
        existingUnits: Int
        proposedUnits: Int
        existingAffordableUnits: Int
        proposedAffordableUnits: Int
        proposedUse: String
        description: String
    }

    input StreetNumberInfo {
        streetName: String!
        streetNameSuffix: String
        streetNumber: Int!
        streetNumberSuffix: String
    }

    extend type Mutation {
        updatePermits(permits: [PermitInfo]!): String
    }
`

type PermitStatusQL = "FILING"
    | "FILED"
    | "ISSUED"
    | "COMPLETED"
    | "EXPIRED"
    | "CANCELLED"
    | "DISAPPROVED"
    | "APPROVED"
    | "ISSUING"
    | "REVOKED"
    | "WITHDRAWN"
    | "PLANCKECK"
    | "SUSPENDED"
    | "REINSTATED"
    | "INSPECTING"
    | "UPHELD"
    | "INCOMPLETE"
    | "GRANTED"

type PermitTypeQL = "NEW_CONSTRUCTION" |
    "ADDITIONS_ALTERATIONS_REPARE" |
    "OTC_ADDITIONS" |
    "WALL_OR_PAINTED_SIGN" |
    "SIGN_ERRECT" |
    "DEMOLITIONS" |
    "GRADE_QUARRY_FILL_EXCAVATE"

interface PermitInfo {
    id: string
    status?: PermitStatus
    type?: PermitType
    typeWood?: boolean

    statusUpdatedAt?: string
    createdAt?: string
    issuedAt?: string
    completedAt?: string
    expiredAt?: string
    street?: [StreetNumberInfo]

    existingStories?: number;
    proposedStories?: number;
    existingUnits?: number;
    proposedUnits?: number;
    existingAffordableUnits?: number;
    proposedAffordableUnits?: number;
    proposedUse?: string;
    description?: string;
}

interface StreetNumberInfo {
    streetName: string
    streetNameSuffix?: string
    streetNumber: number
    streetNumberSuffix?: string
}

function convertStateToQL(state?: PermitStatus): PermitStatusQL | null {
    if (!state) {
        return null
    }
    return state.toUpperCase() as PermitStatusQL
}

function convertTypeToQL(state?: PermitType): PermitTypeQL | null {
    if (!state) {
        return null
    }
    return state.toUpperCase() as PermitTypeQL
}

function convertPermitToQL(res: Permit): any {
    return {
        id: res.permitId,
        status: convertStateToQL(res.permitStatus),
        type: convertTypeToQL(res.permitType),
        typeWood: res.permitTypeWood,
        statusUpdatedAt: res.permitStatusUpdated,
        createdAt: res.permitCreated,
        issuedAt: res.permitIssued,
        expiredAt: res.permitExpired,
        completedAt: res.permitCompleted,
        existingStories: res.existingStories,
        proposedStories: res.proposedStories,
        existingUnits: res.existingUnits,
        proposedUnits: res.proposedUnits,
        existingAffordableUnits: res.existingAffordableUnits,
        proposedAffordableUnits: res.proposedAffordableUnits,
        proposedUse: res.proposedUse,
        description: res.description,

        streetNumbers: res.streetNumbers!!.map((n) => ({
            streetId: n.street!!.id,
            streetName: n.street!!.name,
            streetNameSuffix: n.street!!.suffix,
            streetNumber: n.number,
            streetNumberSuffix: n.suffix
        }))
    }
}

export const Resolver = {
    Query: {
        permit: async function (_: any, args: { id: string }, context: Context) {
            var res = await DB.Permit.findOne({
                where: {
                    account: context.accountId,
                    permitId: args.id
                },
                include: [{
                    model: DB.StreetNumber,
                    as: 'streetNumbers',
                    include: [{
                        model: DB.Street,
                        as: 'street'
                    }]
                }]
            })
            if (res != null) {
                return convertPermitToQL(res)
            } else {
                return null
            }
        },
        permits: async function (_: any, args: { filter?: string, first: number, after?: string }, context: Context) {
            if (args.first > 100) {
                throw "first can't be bigger than 100"
            }
            let res = await DB.Permit.findAndCountAll({
                where: (args.filter && args.filter != "")
                    ? (
                        args.after
                            ? {
                                account: context.accountId,
                                permitId: {
                                    $like: args.filter,
                                    $gt: args.after
                                }
                            } : {
                                account: context.accountId,
                                permitId: {
                                    $like: args.filter
                                }
                            }
                    )
                    : args.after
                        ? {
                            account: context.accountId,
                            permitId: {
                                $gt: args.after
                            }
                        } : {
                            account: context.accountId
                        },
                order: [['permitCreated', 'DESC']],
                limit: args.first,
                include: [{
                    model: DB.StreetNumber,
                    as: 'streetNumbers',
                    include: [{
                        model: DB.Street,
                        as: 'street'
                    }]
                }]
            })
            return {
                edges: res.rows.map((p) => {
                    return {
                        node: convertPermitToQL(p),
                        cursor: p.permitId
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
        updatePermits: async function (_: any, args: { permits: [PermitInfo] }, context: Context) {
            await applyPermits(context.accountId, args.permits)
            return "ok"
        }
    }
}