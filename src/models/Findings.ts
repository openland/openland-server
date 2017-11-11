import { DB, Findings } from '../tables'
import { Context } from './Context'

export const Schema = `
    type Findings {
        id: ID!
        title: String!
        intro: String!
        description: String
        recomendations: String
    }

    extend type Query {
        findings: Findings
    }

    extend type Mutation {
        createFindings(title: String!, intro: String!): Findings
        alterFindings(title: String, intro: String, description: String, recomendations: String): Findings
    }
`

function convertFindings(findings: Findings) {
    return {
        _dbid: findings.id,
        id: findings.id,
        intro: findings.intro,
        title: findings.title,
        description: findings.description,
        recomendations: findings.recomendations
    }
}

export const Resolver = {
    Query: {
        findings: async function (_: any, args: { }, context: Context) {
            var accountId = context.requireAccount()
            var res = await DB.Findings.findOne({
                where: {
                    account: accountId
                }
            })
            if (res == null) {
                return null
            }
            return convertFindings(res)
        }
    },
    Mutation: {
        createFindings: async function (_: any, args: { title: string, intro: string }, context: Context) {
            var accountId = context.requireAccount()
            var res = await DB.Findings.create({
                account: accountId,
                title: args.title,
                intro: args.intro
            })
            return convertFindings(res)
        },
        alterFindings: async function (_: any, args: { title?: string, intro?: string, description?: string, recomendations?: string }, context: Context) {
            var accountId = context.requireAccount()
            var res = await DB.Findings.findOne({
                where: {
                    account: accountId
                }
            })
            if (res == null) {
                throw "Unable to find Findings"
            }
            if (args.intro != null) {
                res.intro = args.intro
            }
            if (args.title != null) {
                res.title = args.title
            }
            if (args.description != null) {
                res.description = args.description
            }
            if (args.recomendations != null) {
                res.recomendations = args.recomendations
            }
            await res.save()
            return convertFindings(res)
        }
    }
}