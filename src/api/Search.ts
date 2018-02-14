
export const Schema = `
    type SearchResult {
        query: String!
    }

    extend type Query {
        search(query: String!): SearchResult!
    }
`;

export const Resolvers = {
    Query: {
        search: async function (_: any, args: { query: string }) {
            return {
                query: args.query
            };
        }
    }
};