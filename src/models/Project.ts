import { DB, Project } from '../tables'
import { Context } from './Context';
import { resolveAccountId } from './Account';

export const Schema = `
    
    input LinkInput {
        title: String!
        url: String!
    }

    type Link {
        title: String!
        url: String!
    }

    type Project {
        id: ID!
        name: String!
        slug: String!
        activated: Boolean!
        isPrivate: Boolean!

        description: String
        findings: String
        intro: String
        
        sources: [Link!]!
        outputs: [Link!]!
    }

    extend type Query {
        projects(domain: String, showDeactivated: Boolean): [Project!]
        project(domain: String, slug: String!): Project!
    }
    extend type Mutation {
        createProject(domain: String, name: String!, slug: String!, description: String, findings: String, intro: String): Project!
        alterProject(id: ID!, name: String, slug: String, description: String, findings: String, intro: String, outputs: [LinkInput!], sources: [LinkInput!], isPrivate: Boolean): Project!
    }
`

interface LinkRef {
    title: string;
    url: string;
}

function parseLinks(src: string): LinkRef[] {
    return JSON.parse(src) as LinkRef[];
}

function saveLinks(links: LinkRef[]): string {
    return JSON.stringify(links);
}

function convertProject(project: Project) {
    console.warn(project.isPrivate)
    if (project.isPrivate) {
        return {
            _dbid: project.id,
            id: project.id,
            slug: project.slug,
            name: project.name,
            intro: project.intro,
            sources: [],
            outputs: [],
            isPrivate: false,
        }
    } else {
        return {
            _dbid: project.id,
            id: project.id,
            slug: project.slug,
            name: project.name,
            intro: project.intro,
            description: project.description,
            findings: project.findings,
            sources: parseLinks(project.sources),
            outputs: parseLinks(project.outputs),
            isPrivate: true
        }
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
                intro: args.intro,
                findings: args.findings,
                outputs: saveLinks([]),
                sources: saveLinks([]),
                isPrivate: false,
            }))
            return convertProject(res)
        },

        alterProject: async function (_: any, args: { id: string, name?: string, slug?: string, description?: string, intro?: string, findings?: string, outputs?: [LinkRef], sources?: [LinkRef], isPrivate?: boolean }, context: Context) {
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
                if (args.description === '') {
                    res.description = undefined
                } else {
                    res.description = args.description;
                }
            }
            if (args.intro != null) {
                if (args.intro === '') {
                    res.intro = undefined
                } else {
                    res.intro = args.intro;
                }
            }
            if (args.findings != null) {
                if (args.findings === '') {
                    res.findings = undefined;
                } else {
                    res.findings = args.findings;
                }
            }
            if (args.outputs != null) {
                res.outputs = saveLinks(args.outputs)
            }
            if (args.sources != null) {
                res.sources = saveLinks(args.sources)
            }
            if (args.isPrivate != null) {
                res.isPrivate = args.isPrivate
            }
            await res.save()
            return convertProject(res)
        }
    }
}