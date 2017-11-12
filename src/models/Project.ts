import { DB, Project } from '../tables'
import { Context } from './Context';

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

        sortKey: String
    }

    extend type Query {
        projects(showDeactivated: Boolean): [Project!]
        project(slug: String!): Project!
    }
    extend type Mutation {
        createProject(name: String!, slug: String!, description: String, findings: String, intro: String): Project!
        alterProject(id: ID!, name: String, slug: String, description: String, findings: String, intro: String, outputs: [LinkInput!], sources: [LinkInput!], isPrivate: Boolean, sortKey: String): Project!
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
            sortKey: project.sorting,
            isPrivate: true,
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
            sortKey: project.sorting,
            isPrivate: false
        }
    }
}

export const Resolver = {

    Query: {
        projects: async function (_: any, args: { showDeactivated?: boolean }, context: Context) {
            if (args.showDeactivated != null && args.showDeactivated) {
                return (await DB.Project.findAll({
                    where: {
                        account: context.accountId
                    },
                    order: [
                        ['sorting', 'ASC'],
                        ['name', 'ASC']
                    ]
                })).map(convertProject)
            } else {
                return (await DB.Project.findAll({
                    where: {
                        account: context.accountId,
                        activated: true
                    },
                    order: [
                        ['sorting', 'ASC'],
                        ['name', 'ASC']
                    ]
                })).map(convertProject)
            }
        },
        project: async function (_: any, args: { slug: string }, context: Context) {
            var res = await DB.Project.find({
                where: {
                    account: context.accountId,
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
        createProject: async function (_: any, args: { name: string, slug: string, description?: string, intro?: string, findings?: string }, context: Context) {
            context.requireWriteAccess()
            var res = (await DB.Project.create({
                account: context.accountId,
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

        alterProject: async function (_: any, args: { id: string, name?: string, slug?: string, description?: string, intro?: string, findings?: string, outputs?: [LinkRef], sources?: [LinkRef], isPrivate?: boolean, sortKey?: string }, context: Context) {
            context.requireWriteAccess()
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
            if (args.sortKey != null) {
                res.sorting = args.sortKey
            }
            await res.save()
            return convertProject(res)
        }
    }
}