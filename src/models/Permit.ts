import { Context } from "./Context";
import { DB } from "../tables/index";
import { PermitAttributes, Permit } from "../tables/Permit";


export const Schema = `

    type Permit {
        id: ID!
        status: String
        address: String
        createdAt: String
        issuedAt: String
        completedAt: String
        expiredAt: String
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
        address: String
        createdAt: String
        issuedAt: String
        completedAt: String
        expiredAt: String
    }

    extend type Mutation {
        updatePermits(permits: [PermitInfo]!): String
    }
`

interface PermitInfo {
    id: string
    status?: "filled" | "issued" | "expired" | "completed"
    address?: string
    createdAt?: string
    issuedAt?: string
    completedAt?: string
    expiredAt?: string
}

function convertDate(src?: string): Date | undefined {
    if (src) {
        return new Date(src)
    } else {
        return undefined
    }
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
                limit: args.first
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
            console.info("Starting bulk insert/update of permits")
            console.time("bulk_all")
            await DB.tx(async (tx) => {
                console.time("load_all")
                let existing = await DB.Permit.findAll({
                    where: {
                        account: context.accountId,
                        permitId: args.permits.map(p => p.id)
                    },
                    lock: tx.LOCK.UPDATE
                })
                console.timeEnd("load_all")

                console.time("prepare")
                var pending = Array<PermitAttributes>()
                var waits = Array<PromiseLike<Permit>>()

                var map: { [key: string]: Permit } = {}
                for (let p of existing) {
                    map[p.permitId!!] = p
                }
                for (let p of args.permits) {
                    let ex = map[p.id]
                    if (ex) {
                        if (p.createdAt) {
                            ex.permitCreated = convertDate(p.createdAt)
                        }
                        if (p.expiredAt) {
                            ex.permitExpired = convertDate(p.createdAt)
                        }
                        if (p.issuedAt) {
                            ex.permitIssued = convertDate(p.issuedAt)
                        }
                        if (p.completedAt) {
                            ex.permitCompleted = convertDate(p.completedAt)
                        }
                        if (p.address) {
                            ex.address = p.address
                        }
                        if (p.status) {
                            ex.permitStatus = p.status
                        }
                        waits.push(ex.save())
                    } else {
                        pending.push({
                            account: context.accountId,
                            permitId: p.id,
                            address: p.address,
                            permitStatus: p.status,
                            permitCreated: convertDate(p.createdAt),
                            permitIssued: convertDate(p.issuedAt),
                            permitExpired: convertDate(p.expiredAt),
                            permitCompleted: convertDate(p.completedAt)
                        })
                    }
                }
                console.timeEnd("prepare")

                if (pending.length > 0) {
                    console.time("insert")
                    await DB.Permit.bulkCreate(pending)
                    console.timeEnd("insert")
                }


                if (waits.length > 0) {
                    console.time("waiting")
                    for (let p of waits) {
                        await p
                    }
                    console.timeEnd("waiting")
                }
            });
            console.timeEnd("bulk_all")
            return "ok"
        }
    }
}