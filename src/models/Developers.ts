import { CallContext } from "./CallContext";
import { DB } from "../tables/index";
import { Developer } from "../tables/Developer";

export const Schema = `
    type Developer {
        id: ID!
        slug: String!
        title: String!
        comments: String
    }

    extend type Query {
        developers: [Developer!]!
        developer(slug: String!): Developer!
    }

    extend type Mutation {
        addDeveloper(slug: String!, title: String!): Developer!
        alterDeveloper(slug: String!, title: String, comments: String): Developer!
        removeDeveloper(slug: String!): String
    }
`;

export const Resolver = {
    Developer: {
        id: (src: Developer) => src.id,
        slug: (src: Developer) => src.slug,
        title: (src: Developer) => src.title,
        comments: (src: Developer) => src.comments
    },
    Query: {
        developers: function (_: any, args: {}, context: CallContext) {
            return DB.Developer.findAll({ where: { account: context.accountId } })
        },
        developer: function (_: any, args: { slug: string }, context: CallContext) {
            return DB.Developer.findOne({ where: { account: context.accountId, slug: args.slug } })
        }
    },
    Mutation: {
        addDeveloper: async function (_: any, args: { slug: string, title: string }, context: CallContext) {
            context.requireWriteAccess()
            return DB.Developer.create({
                account: context.accountId,
                slug: args.slug.toLowerCase(),
                title: args.title
            })
        },
        removeDeveloper: async function (_: any, args: { slug: string }, context: CallContext) {
            let existing = await DB.Developer.findOne({
                where: {
                    account: context.accountId,
                    slug: args.slug.toLowerCase()
                }
            })
            if (existing) {
                await existing.destroy()
                return "ok"
            }
            else {
                throw "Not found"
            }
        },
        alterDeveloper: async function (_: any, args: { slug: string, title?: string, comments?: string }, context: CallContext) {
            let existing = await DB.Developer.findOne({
                where: {
                    account: context.accountId,
                    slug: args.slug.toLowerCase()
                }
            })
            if (!existing) {
                throw "Not found"
            }
            if (args.title != null) {
                existing.title = args.title
                await existing.save()
            }
            if (args.comments != null) {
                let trimmed = args.comments.trim()
                if (trimmed.length > 0) {
                    existing.comments = trimmed
                } else {
                    existing.comments = null
                }
                await existing.save()
            }
            return existing;
        }
    }
}