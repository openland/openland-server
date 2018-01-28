import { AccountRepository } from '../repositories/AccountRepository';

export const Schema = `
    type Place {
        id: ID!
        slug: String!
    }

    extend type Query {
        place(slug: String!): Place!
    }
`;

export const Resolver = {
    Query: {
        place: async function (_: any, args: { slug: string }) {
            let account = await new AccountRepository().resolveAccount(args.slug);
            return {
                id: account,
                slug: args.slug.toLocaleLowerCase()
            };
        }
    }
};