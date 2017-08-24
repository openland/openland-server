import { DB, Account } from '../tables'
import { Context } from './Context'

export const Schema = `
    type Account {
        id: ID!
        domain: String!
        name: String!
        city: String
    }

    type AdminAccount {
        id: ID!
        domain: String!
        name: String!
        city: String
        activated: Boolean!
    }

    type Admin {
        accounts: [AdminAccount!]
        account(domain: String!): AdminAccount!
    }

    extend type Query {
        account(domain: String): Account!
        admin: Admin!
    }

    extend type Mutation {
        adminCreateAccount(domain: String!, name: String!, city: String): AdminAccount
        adminAlterAccount(domain: String!, newName: String, newActivated: Boolean, newDomain: String, newCity: String): AdminAccount
    }
`

function convertAccount(account: Account | undefined | null) {
    if (account == null || account == undefined) {
        return null
    }
    return {
        _dbid: account.id,
        id: account.id,
        domain: account.slug,
        name: account.name,
        activated: account.activated,
        city: account.city
    }
}

export async function resolveAccountId(domain: string) {
    var res = (await DB.Account.findOne({
        where: {
            slug: domain
        }
    }))
    if (res == null) {
        throw "Unable to find account " + domain
    }
    return res.id!!
}

export const Resolver = {
    Query: {
        admin: () => { return {} },
        account: async function (_: any, args: { domain?: string }, context: Context) {
            var domain = context.resolveDomain(args.domain)
            return convertAccount(await DB.Account.findOne({
                where: {
                    slug: domain,
                    activated: true
                }
            }))
        }
    },
    Admin: {
        accounts: () => DB.Account.findAll().map(convertAccount),
        account: async function (_: any, args: { domain: string }) {
            return convertAccount((await DB.Account.findOne({
                where: {
                    slug: args.domain.toLowerCase()
                }
            }))!!);
        }
    },
    Mutation: {
        adminCreateAccount: async function (_: any, args: { domain: string, name: string, city: string }) {
            return convertAccount(await DB.Account.create({
                slug: args.domain,
                name: args.name,
                city: args.city
            }));
        },
        adminAlterAccount: async function (_: any, args: { domain: string, newName?: string, newActivated?: boolean, newDomain?: string, newCity?: string }) {
            var res = (await DB.Account.findOne({
                where: {
                    slug: args.domain.toLowerCase()
                }
            }))!!
            if (args.newName != null) {
                res.name = args.newName
            }
            if (args.newActivated != null) {
                res.activated = args.newActivated
            }
            if (args.newDomain != null) {
                res.slug = args.newDomain.toLowerCase()
            }
            if (args.newCity != null) {
                if (args.newCity === '') {
                    res.city = undefined
                } else {
                    res.city = args.newCity
                }
            }
            res.save()
            return convertAccount(res)
        }
    }
}