import { withPermission } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { IDs } from 'openland-module-api/IDs';

export default {
    Mutation: {
        betaFixCounter: withPermission('super-admin', async (ctx, args) => {
            return await Modules.Messaging.fixer.fixForUser(ctx, IDs.User.parse(args.uid));
        }),
        betaFixCountersForAll: withPermission('super-admin', async (ctx, args) => {
            return await Modules.Messaging.fixer.fixForAllUsers(ctx);
        }),
    }
} as GQLResolver;