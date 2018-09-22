import { withAuth } from './utils/Resolvers';

export const Resolver = {
    Query: {
        devPersonalTokens: withAuth((args, uid) => {
            return [];
        })
    }
};