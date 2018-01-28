import { Repos } from '../repositories/index';

export const Schema = `
    type Area {
        id: ID!
        slug: String!
    }

    extend type Query {
        area(slug: String!): Area!
    }
`;

export const Resolver = {
    Query: {
        area: async function (_: any, args: { slug: string }) {
            return Repos.Area.resolveArea(args.slug);
        }
    }
};