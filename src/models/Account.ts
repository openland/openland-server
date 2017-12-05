import { DB, Account } from '../tables'
import { Context } from './Context'
import { User } from '../tables/User';

export const Schema = `
    type Account {
        id: ID!
        domain: String!
        name: String!
        city: String
        needAuthentication: Boolean!
        readAccess: Boolean!
        writeAccess: Boolean!
        generation: Int!
    }

    extend type Query {
        account: Account!
    }
`

export const AdminSchema = `

    type Account {
        id: ID!
        domain: String!
        name: String!
        city: String
        activated: Boolean!
    }

    type User {
        id: ID!
        firstName: String!
        lastName: String!
        email: String!
    }

    extend type Query {
        accounts: [Account!]
        account(domain: String!): Account!
        users: [User]
    }
    extend type Mutation {
        createAccount(domain: String!, name: String!, city: String): Account
        alterAccount(domain: String!, newName: String, newActivated: Boolean, newDomain: String, newCity: String): Account
        addOwner(domain: String!, uid: ID!): Boolean
        removeOwner(domain: String!, uid: ID!): Boolean
    }
`

function convertAccount(account: Account | undefined | null, context: Context) {
    if (account == null || account == undefined) {
        return null
    }
    return {
        _dbid: account.id,
        id: account.id,
        domain: account.slug,
        name: account.name,
        city: account.city,
        needAuthentication: false,
        readAccess: true,
        writeAccess: context.owner,
        generation: account.generation
    }
}

function convertUser(user: User) {
    return {
        _dbid: user.id,
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
    }
}

function convertAdminAccount(account: Account | undefined | null) {
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
        throw new Error("404: Unable to find account " + domain)
    }
    return res.id!!
}

export const Resolver = {
    Query: {
        account: async function (_: any, args: {}, context: Context) {
            var account = await DB.Account.findOne({
                where: {
                    id: context.accountId,
                    activated: true
                }
            })!!;
            return convertAccount(account, context)
        }
    }
}

export const AdminResolver = {
    Query: {
        accounts: (_: any, args: {}) =>
            DB.Account.findAll().map(acc => convertAdminAccount(acc as Account)),
        account: async function (_: any, args: { domain: string }) {
            return convertAdminAccount((await DB.Account.findOne({
                where: {
                    slug: args.domain.toLowerCase()
                }
            }))!!);
        },
        users: () =>
            DB.User.findAll().map(src => convertUser(src as User))
    },
    Mutation: {
        createAccount: async function (_: any, args: { domain: string, name: string, city: string }) {
            return convertAdminAccount(await DB.Account.create({
                slug: args.domain,
                name: args.name,
                city: args.city
            }));
        },
        alterAccount: async function (_: any, args: { domain: string, newName?: string, newActivated?: boolean, newDomain?: string, newCity?: string }) {
            return DB.tx(async (tx) => {
                var res = (await DB.Account.findOne({
                    where: {
                        slug: args.domain.toLowerCase()
                    },
                    lock: tx.LOCK.UPDATE
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
                return convertAdminAccount(res)
            })
        },
        addOwner: async function (_: any, args: { domain: string, uid: number }) {
            return DB.tx(async (tx) => {
                var res = (await DB.Account.findOne({
                    where: {
                        slug: args.domain.toLowerCase()
                    }
                }))
                if (res == null) {
                    throw "Unable to find account"
                }

                var user = await DB.User.findById(args.uid)
                if (user == null) {
                    throw "Unable to find user"
                }

                var m = await DB.AccountMember.findOne({
                    where: {
                        userId: user.id,
                        accountId: res.id
                    },
                    lock: tx.LOCK.UPDATE
                })
                if (m != null) {
                    if (!m.owner) {
                        m.owner = true
                        await m.save()
                    }
                } else {
                    DB.AccountMember.create({
                        userId: user.id,
                        accountId: res.id,
                        owner: true
                    })
                }
                return true
            })
        },

        removeOwner: async function (_: any, args: { domain: string, uid: number }) {
            return DB.tx(async (tx) => {
                var res = (await DB.Account.findOne({
                    where: {
                        slug: args.domain.toLowerCase()
                    }
                }))
                if (res == null) {
                    throw "Unable to find account"
                }

                var user = await DB.User.findById(args.uid)
                if (user == null) {
                    throw "Unable to find user"
                }

                var m = await DB.AccountMember.findOne({
                    where: {
                        userId: user.id,
                        accountId: res.id
                    },
                    lock: tx.LOCK.UPDATE
                })
                if (m != null) {
                    if (m.owner) {
                        m.owner = false
                        await m.save()
                    }
                }
                return true
            })
        }
    }
}