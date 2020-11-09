import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { withAny } from 'openland-module-api/Resolvers';

export const Resolver: GQLResolver = {
    Mutation: {
        track: withAny(async (ctx, args) => {
            return 'ok';
        })
    }
};
