import { DB, Account } from '../tables'
import { Context } from './Context'
import { AccountMember } from '../tables/Account';

export const Schema = `
    type Account {
        id: ID!
        domain: String!
        name: String!
        city: String
        needAuthentication: Boolean!
        readAccess: Boolean!
        writeAccess: Boolean!
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
        account: Account!
        admin: Admin!
    }

    extend type Mutation {
        adminCreateAccount(domain: String!, name: String!, city: String): AdminAccount
        adminAlterAccount(domain: String!, newName: String, newActivated: Boolean, newDomain: String, newCity: String): AdminAccount
    }
`

function convertAccount(account: Account | undefined | null, member: AccountMember | null) {
    if (account == null || account == undefined) {
        return null
    }
    return {
        _dbid: account.id,
        id: account.id,
        domain: account.slug,
        name: account.name,
        activated: account.activated,
        city: account.city,
        needAuthentication: false,
        readAccess: true,
        writeAccess: member != null && member.owner
    }
}

export async function resolveAccountId(domain: string) {
    var res = (await DB.Account.findOne({
        where: {
            slug: domain
        }
    }))
    if (res == null) {
        throw new Error("404: Unable to find account " + domain)
    }
    return res.id!!
}

export const Resolver = {
    Query: {
        admin: () => { return {} },
        account: async function (_: any, args: {}, context: Context) {
            var domainId = context.requireAccount()
            var account = await DB.Account.findOne({
                where: {
                    id: domainId,
                    activated: true
                }
            });
            if (account == null) {
                throw new Error("404: Unable to find account " + context.domain)
            }
            var member: AccountMember | null = null
            if (context.uid != null) {
                member = await DB.AccountMember.findOne({
                    where: {
                        accountId: account.id,
                        userId: context.uid
                    }
                })
            }
            return convertAccount(account, member)
        }
    },
    Admin: {
        accounts: () => DB.Account.findAll().map(acc => { convertAccount(acc as Account, null) }),
        account: async function (_: any, args: { domain: string }) {
            return convertAccount((await DB.Account.findOne({
                where: {
                    slug: args.domain.toLowerCase()
                }
            }))!!, null);
        }
    },
    Mutation: {
        adminCreateAccount: async function (_: any, args: { domain: string, name: string, city: string }) {
            return convertAccount(await DB.Account.create({
                slug: args.domain,
                name: args.name,
                city: args.city
            }), null);
        },
        adminAlterAccount: async function (_: any, args: { domain: string, newName?: string, newActivated?: boolean, newDomain?: string, newCity?: string }) {
            var res = (await DB.Account.findOne({
                where: {
                    slug: args.domain.toLowerCase()
                }
            }))
            if (res == null) {
                throw "Unable to find account"
            }
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
            return convertAccount(res, null)
        }
    }
}