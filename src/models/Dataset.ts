import { DB } from '../tables'
import { Context } from './Context';
import { resolveAccountId } from './Account';

export const Schema = `
    type DataSet {
        id: ID!
        name: String!
        description: String!
        link: String!
        kind: String!
    }
    extend type Query {
        datasets(domain: String, kind: String): [DataSet!]
    }
`

export const Resolver = {
    Query: {
        async datasets(_: any, args: { domain?: string, kind?: string }, context: Context) {
            var domain = context.resolveDomain(args.domain)
            var accountId = await resolveAccountId(domain)
            var datasets = (await DB.DataSet.findAll({
                where: {
                    account: accountId
                }
            }))

            return datasets.map((args) => {
                return {
                    _dbid: args.id,
                    id: args.id,
                    name: args.name,
                    description: args.description,
                    link: args.link,
                    kind: args.kind
                }
            });
        }
    }
}