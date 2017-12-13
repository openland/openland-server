import { CallContext } from "./CallContext";
import { DB } from "../tables/index";
import { Developer } from "../tables/Developer";

export const Schema = `
    type Developer {
        id: ID!
        slug: String!
        title: String!
    }

    extend type Query {
        developers: [Developer!]!
    }

    extend type Mutation {
        addDeveloper(slug: String!, title: String!): Developer!
    }
`;

export const Resolver = {
    Developer: {
        id: (src: Developer) => src.id,
        slug: (src: Developer) => src.slug,
        title: (src: Developer) => src.title
    },
    Query: {
        developers: async function (_: any, args: {}, context: CallContext) {
            return DB.Developer.findAll({ where: { account: context.accountId } })
        }
    },
    Mutation: {
        addDeveloper: async function (_: any, args: { slug: string, title: string }, context: CallContext) {
            context.requireWriteAccess()
            return DB.Developer.create({
                slug: args.slug,
                title: args.title
            })
        }
    }
}