import { DB, Findings } from '../tables'
import { Context } from './Context'
import { resolveAccountId } from './Account';

export const Schema = `
    type Findings {
        id: ID!
        title: String!
        intro: String!
    }

    extend type Query {
        findings(domain: String): Findings
    }

    extend type Mutation {
        createFindings(domain: String, title: String!, intro: String!): Findings
        alterFindings(domain: String, newTitle: String, newIntro: String): Findings
    }
`

function convertFindings(findings: Findings) {
    return {
        _dbid: findings.id,
        id: findings.id,
        intro: findings.intro,
        title: findings.title
    }
}

export const Resolver = {
    Query: {
        findings: async function (_: any, args: { domain?: string }, context: Context) {
            var domain = context.resolveDomain(args.domain)
            var accountId = await resolveAccountId(domain)
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
        createFindings: async function (_: any, args: { domain?: string, title: string, intro: string }, context: Context) {
            var domain = context.resolveDomain(args.domain)
            var accountId = await resolveAccountId(domain)
            var res = await DB.Findings.create({
                account: accountId,
                title: args.title,
                intro: args.intro
            })
            return convertFindings(res)
        },
        alterFindings: async function (_: any, args: { domain?: string, newTitle?: string, newIntro?: string }, context: Context) {
            var domain = context.resolveDomain(args.domain)
            var accountId = await resolveAccountId(domain)
            var res = await DB.Findings.findOne({
                where: {
                    account: accountId
                }
            })
            if (res == null) {
                throw "Unable to find Findings"
            }
            if (args.newIntro != null) {
                res.intro = args.newIntro
            }
            if (args.newTitle != null) {
                res.title = args.newTitle
            }
            await res.save()
            return convertFindings(res)
        }
    }
}