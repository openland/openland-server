import { Context } from "./Context";
import { DB } from "../tables/index";
import { applyPermits } from "../repositories/Permits";

export const Schema = `

    type Permit {
        id: ID!
        status: String
        createdAt: String
        issuedAt: String
        completedAt: String
        expiredAt: String
        streetNumbers: [StreetNumber!]!
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
    }

    input PermitInfo {
        id: ID!
        status: String
        createdAt: String
        issuedAt: String
        completedAt: String
        expiredAt: String
        street: [StreetNumberInfo!]
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

interface PermitInfo {
    id: string
    status?: "filled" | "issued" | "expired" | "completed"
    createdAt?: string
    issuedAt?: string
    completedAt?: string
    expiredAt?: string
    street?: [StreetNumberInfo]
}

interface StreetNumberInfo {
    streetName: string
    streetNameSuffix?: string
    streetNumber: number
    streetNumberSuffix?: string
}

export const Resolver = {
    Query: {
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
                order: [['permitId', 'ASC']],
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
                        node: {
                            id: p.permitId,
                            status: p.permitStatus,
                            createdAt: p.permitCreated,
                            issuedAt: p.permitIssued,
                            expiredAt: p.permitExpired,
                            completedAt: p.permitCompleted,
                            streetNumbers: p.streetNumbers!!.map((n) => ({
                                streetId: n.street!!.id,
                                streetName: n.street!!.name,
                                streetNameSuffix: n.street!!.suffix,
                                streetNumber: n.number,
                                streetNumberSuffix: n.suffix
                            }))
                        },
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