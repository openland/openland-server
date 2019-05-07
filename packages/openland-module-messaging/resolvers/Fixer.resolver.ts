import { withPermission } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { IDs } from 'openland-module-api/IDs';
import { createEmptyContext } from '../../openland-utils/Context';
import { FDB } from '../../openland-module-db/FDB';

export default {
    Mutation: {
        betaFixCounter: withPermission('super-admin', async (ctx, args) => {
            return await Modules.Messaging.fixer.fixForUser(ctx, IDs.User.parse(args.uid));
        }),
        betaFixCountersForAll: withPermission('super-admin', async (ctx, args) => {
            let users = await FDB.User.findAll(createEmptyContext());
            for (let user of users) {
                try {
                    await Modules.Messaging.fixer.fixForUser(createEmptyContext(), user.id);
                } catch (e) {
                    console.log('betaFixCountersForAll_error', e);
                }
            }
            console.log('betaFixCountersForAll_done');
            return true;
        }),
    }
} as GQLResolver;