import { Context } from "./Context";
import { DB } from "../tables/index";
import { PermitAttributes } from "../tables/Permit";


export const Schema = `
    type Permit {
        id: ID!
        status: String!
        address: String
        createdAt: String!
        issuedAt: String
        completedAt: String
        expiredAt: String
    }

    extend type Query {
        permits: [Permit!]!
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
        permits() {
            return []
        }
    },
    Mutation: {
        updatePermits: async function (_: any, args: { permits: [PermitInfo] }, context: Context) {

        
            await DB.tx(async (tx) => {
                console.time("prepare")
                var pending = Array<PermitAttributes>()
                var waits = Array<Promise<void>>()
                async function updatePermit(p: PermitInfo) {
                    let existing = await DB.Permit.findOne({
                        where: {
                            account: context.accountId,
                            permitId: p.id
                        }
                    })
                    if (existing != null) {
                        if (p.createdAt) {
                            existing.permitCreated = convertDate(p.createdAt)
                        }
                        if (p.expiredAt) {
                            existing.permitExpired = convertDate(p.createdAt)
                        }
                        if (p.issuedAt) {
                            existing.permitIssued = convertDate(p.issuedAt)
                        }
                        if (p.completedAt) {
                            existing.permitCompleted = convertDate(p.completedAt)
                        }
                        if (p.address) {
                            existing.address = p.address
                        }
                        if (p.status) {
                            existing.permitStatus = p.status
                        }
                        await existing.save()
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

                for (let p of args.permits) {
                    waits.push(updatePermit(p))
                }
                console.timeEnd("prepare")

                console.time("waiting")
                for (let p of waits) {
                    await p
                }
                console.timeEnd("waiting")

                if (pending.length > 0) {
                    console.time("insert")
                    await DB.Permit.bulkCreate(pending)
                    console.timeEnd("insert")
                }
            });
            return "ok"
        }
    }
}