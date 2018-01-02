import { CallContext } from './CallContext';
import { DB } from '../tables';
import { Developer } from '../tables';
import { applyAlterString } from '../utils/updater';

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
        city: (src: Developer) => src.city,
        address: (src: Developer) => src.address,
        linkedin: (src: Developer) => src.linkedin,
        facebook: (src: Developer) => src.facebook,
        twitter: (src: Developer) => src.twitter,
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
            return DB.Developer.findAll({where: {account: context.accountId}, order: ['slug']});
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
            logo?: string | null,
            city?: string | null,
            address?: string | null,
            url?: string | null,
            twitter?: string | null
            linkedin?: string | null
            facebook?: string | null
            comments?: string | null,
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
            }
            if (args.logo !== undefined) {
                existing.logo = applyAlterString(args.logo);
            }
            if (args.city !== undefined) {
                existing.city = applyAlterString(args.city);
            }
            if (args.address !== undefined) {
                existing.address = applyAlterString(args.address);
            }
            if (args.url !== undefined) {
                existing.url = applyAlterString(args.url);
            }
            if (args.twitter !== undefined) {
                existing.twitter = applyAlterString(args.twitter);
            }
            if (args.linkedin !== undefined) {
                existing.linkedin = applyAlterString(args.linkedin);
            }
            if (args.facebook !== undefined) {
                existing.facebook = applyAlterString(args.facebook);
            }
            if (args.comments !== undefined) {
                existing.comments = applyAlterString(args.comments);
            }

            await existing.save();
            return existing;
        }
    }
};