import { DB, Account } from '../tables'

export const Schema = `
    type Account {
        id: ID!
        domain: String!
        name: String!
    }

    type AdminAccount {
        id: ID!
        domain: String!
        name: String!
        activated: Boolean!
    }

    type Admin {
        accounts: [AdminAccount!]
        account(domain: String!): AdminAccount!
    }

    extend type Query {
        account(id: String!): Account!
        admin: Admin!
    }

    extend type Mutation {
        adminCreateAccount(domain: String!, name: String!): AdminAccount
        adminAlterAccount(domain: String!, newName: String, newActivated: Boolean, newDomain: String): AdminAccount
    }
`

function convertAccount(city: Account | undefined | null) {
    if (city == null || city == undefined) {
        return null
    }
    return {
        _dbid: city.id,
        id: city.id,
        domain: city.slug,
        name: city.name,
        activated: city.activated
    }
}

export const Resolver = {
    Query: {
        admin: () => { return {} },
        account: async function (_: any, args: { domain: string }) {
            return convertAccount(await DB.Account.findOne({
                where: {
                    slug: args.domain,
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
        adminCreateAccount: async function (_: any, args: { domain: string, name: string }) {
            return convertAccount(await DB.Account.create({
                slug: args.domain,
                name: args.name
            }));
        },
        adminAlterAccount: async function (_: any, args: { domain: string, newName?: string, newActivated?: boolean, newDomain?: string }) {
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
            res.save()
            return convertAccount(res)
        }
    }
}