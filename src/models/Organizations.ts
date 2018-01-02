import { CallContext } from './CallContext';
import { DB } from '../tables/index';
import { Developer } from '../tables/Developer';

export const Schema = `
    type Organization {
        id: ID!
        slug: String!
        
        title: String!
        logo: String
        city: String
        address: String
        url: String
        twitter: String
        linkedin: String
        facebook: String
        comments: String

        buildingProjects: [BuildingProject!]!
        partners: [Organization!]!
    }

    extend type Query {
        organizations: [Organization!]!
        organization(slug: String!): Organization!
    }
    
    extend type Mutation {
        organizationAdd(slug: String!, title: String!): Organization!
        organizationRemove(slug: String!): String!
        
        organizationAlter(slug: String!, 
            title: String
            logo: String
            city: String
            address: String
            url: String
            twitter: String
            linkedin: String
            facebook: String
            comments: String
        ): Organization!
    }
`;

export const Resolver = {
    Organization: {
        id: (src: Developer) => src.id,
        slug: (src: Developer) => src.slug,
        title: (src: Developer) => src.title,
        logo: (src: Developer) => src.logo,
        url: (src: Developer) => src.url,
        city: (src: Developer) => null,
        address: (src: Developer) => null,
        linkedin: (src: Developer) => null,
        facebook: (src: Developer) => null,
        twitter: (src: Developer) => null,
        comments: (src: Developer) => src.comments,
        buildingProjects: (src: Developer) => src.getBuildingProjects(),
        partners: async (src: Developer) => {
            let projects = await src.getBuildingProjects();
            let developers = new Set<number>();
            for (let p of projects) {
                (await p.getDevelopers()).forEach((d) => {
                    if (d.id !== src.id) {
                        developers.add(d.id!!);
                    }
                });
            }

            return DB.Developer.findAll({
                where: {
                    account: src.account,
                    id: {
                        $in: Array.from(developers)
                    }
                }
            });
        }
    },
    Query: {
        organizations: function (_: any, args: {}, context: CallContext) {
            return DB.Developer.findAll({where: {account: context.accountId}});
        },
        organization: function (_: any, args: { slug: string }, context: CallContext) {
            return DB.Developer.findOne({where: {account: context.accountId, slug: args.slug}});
        }
    },
    Mutation: {
        organizationAdd: async function (_: any, args: { slug: string, title: string }, context: CallContext) {
            context.requireWriteAccess();
            return DB.Developer.create({
                account: context.accountId,
                slug: args.slug.toLowerCase(),
                title: args.title
            });
        },
        organizationRemove: async function (_: any, args: { slug: string }, context: CallContext) {
            context.requireWriteAccess();
            let existing = await DB.Developer.findOne({
                where: {
                    account: context.accountId,
                    slug: args.slug.toLowerCase()
                }
            });
            if (existing) {
                await existing.destroy();
                return 'ok';
            } else {
                throw 'Not found';
            }
        },
        organizationAlter: async function (_: any, args: {
            slug: string,
            title?: string,
            comments?: string | null,
            logo?: string | null
        }, context: CallContext) {
            context.requireWriteAccess();
            let existing = await DB.Developer.findOne({
                where: {
                    account: context.accountId,
                    slug: args.slug.toLowerCase()
                }
            });
            if (!existing) {
                throw 'Not found';
            }
            if (args.title !== undefined) {
                existing.title = args.title;
                await existing.save();
            }
            if (args.logo !== undefined) {
                existing.logo = args.logo;
                await existing.save();
            }
            if (args.comments != null) {
                let trimmed = args.comments.trim();
                if (trimmed.length > 0) {
                    existing.comments = trimmed;
                } else {
                    existing.comments = null;
                }
                await existing.save();
            }
            return existing;
        }
    }
};