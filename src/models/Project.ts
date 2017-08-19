import { DB, Project } from '../tables'
import { Context } from './Context';
import { resolveAccountId } from './Account';

export const Schema = `
    type Project {
        id: ID!
        name: String!
        slug: String!
        activated: Boolean!
        isOpen: Boolean!
    }
    extend type Query {
        projects(domain: String, showDeactivated: Boolean): [Project!]
        project(domain: String, slug: String!): Project
    }
    extend type Mutation {
        createProject(domain: String, name: String!, slug: String!): Project!
    }
`

function convertProject(project: Project) {
    return {
        _dbid: project.id,
        id: project.id,
        slug: project.slug,
        name: project.name,
        isOpen: true
    }
}

export const Resolver = {

    Query: {
        projects: async function (_: any, args: { domain?: string, showDeactivated?: boolean }, context: Context) {
            var domain = context.resolveDomain(args.domain)
            var accountId = await resolveAccountId(domain)
            if (args.showDeactivated != null && args.showDeactivated) {
                return (await DB.Project.findAll({
                    where: {
                        account: accountId
                    }
                })).map(convertProject)
            } else {
                return (await DB.Project.findAll({
                    where: {
                        account: accountId,
                        activated: true
                    }
                })).map(convertProject)
            }
        },
        project: async function (_: any, args: { domain?: string, slug: string }, context: Context) {
            var domain = context.resolveDomain(args.domain)
            var accountId = await resolveAccountId(domain)
            var res = await DB.Project.find({
                where: {
                    account: accountId,
                    slug: args.slug,
                    activated: true
                }
            })
            if (res != null) {
                return convertProject(res)
            } else {
                return null
            }
        }
    },
    Mutation: {
        createProject: async function (_: any, args: { domain?: string, name: string, slug: string }, context: Context) {
            var domain = context.resolveDomain(args.domain)
            var accountId = await resolveAccountId(domain)
            var res = (await DB.Project.create({
                account: accountId,
                name: args.name,
                slug: args.slug,
                activated: true
            }))
            return convertProject(res)
        }
    }
}