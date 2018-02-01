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

export interface AreaContext {
    _areadId: number;
}

export const Resolver = {
    Query: {
        area: async function (_: any, args: { slug: string }) {
            let area = await Repos.Area.resolveArea(args.slug);
            return { ...area, _areadId: area.id };
        }
    }
};