export const Resolvers = {
    Query: {
        search: async function (_: any, args: { query: string }) {
            return {
                query: args.query
            };
        }
    }
};