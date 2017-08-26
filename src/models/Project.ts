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
        events: [Event!]!
        email: String
        description: String
        findings: String
        intro: String
    }

    type Event {
        id: ID!
        title: String!
    }

    extend type Query {
        projects(domain: String, showDeactivated: Boolean): [Project!]
        project(domain: String, slug: String!): Project!
    }
    extend type Mutation {
        createProject(domain: String, name: String!, slug: String!, description: String, findings: String, intro: String): Project!
        alterProject(id: ID!, name: String, slug: String, description: String, findings: String, intro: String): Project!
    }
`

function convertProject(project: Project) {
    return {
        _dbid: project.id,
        id: project.id,
        slug: project.slug,
        name: project.name,
        isOpen: true,
        events: [],
        intro: project.intro,
        description: project.description,
        findings: project.findings
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
                throw "Unable to find project"
            }
        }
    },
    Mutation: {
        createProject: async function (_: any, args: { domain?: string, name: string, slug: string, description?: string, intro?: string, findings?: string }, context: Context) {
            var domain = context.resolveDomain(args.domain)
            var accountId = await resolveAccountId(domain)
            var res = (await DB.Project.create({
                account: accountId,
                name: args.name,
                slug: args.slug,
                activated: true,
                description: args.description,
                into: args.intro,
                findings: args.findings
            }))
            return convertProject(res)
        },

        alterProject: async function (_: any, args: { id: string, name?: string, slug?: string, description?: string, intro?: string, findings?: string }, context: Context) {
            var res = await DB.Project.findOne({
                where: {
                    id: args.id
                }
            });
            if (res == null) {
                throw "Unable to find project"
            }
            if (args.name != null) {
                res.name = args.name
            }
            if (args.slug != null) {
                res.slug = args.slug
            }
            if (args.description != null) {
                res.description = args.description
            }
            if (args.intro != null) {
                res.intro = args.intro
            }
            if (args.findings != null) {
                res.findings = args.findings
            }
            await res.save()
            return convertProject(res)
        }
    }
}