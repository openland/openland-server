import { DB } from "../tables/index";
import { Context } from "./Context";
import { StreetAttributes } from "../tables/Street";

export const Schema = `

    type Street {
        id: ID!
        name: String
        suffix: String
        fullName: String
    }

    input StreetInfo {
        name: String!
        suffix: String
    }

    extend type Mutation {
        updateStreets(streets: [StreetInfo!]!): String
    }
`

interface StreetInfo {
    name: string
    suffix?: string
}

function normalizeStreet(str: string) {
    return str.trim().split(' ').map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ')
}

function normalizeSuffix(str?: string): string | undefined {
    if (str){
        if (str.trim() == ''){
            return undefined
        }
        return normalizeStreet(str)
    }
    return undefined
}

export const Resolver = {
    Mutation: {
        updateStreets: async function (_: any, args: { streets: [StreetInfo] }, context: Context) {
            await DB.tx(async (tx) => {
                var pending = Array<StreetAttributes>()
                for (let str of args.streets) {
                    let nstr = normalizeStreet(str.name)
                    let nsf = normalizeSuffix(str.suffix)
                    let existing = await DB.Street.find({
                        where: {
                            account: context.accountId,
                            name: nstr,
                            suffix: nsf
                        },
                        lock: tx.LOCK.UPDATE
                    })
                    if (existing == null) {
                        pending.push({
                            account: context.accountId,
                            name: nstr,
                            suffix: nsf
                        })
                    }
                }
                if (pending.length > 0) {
                    await DB.Street.bulkCreate(pending)
                }
            })
            return "ok"
        }
    }
}