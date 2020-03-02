import { withPermission } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { IDs } from 'openland-module-api/IDs';
import { Store } from '../../openland-module-db/FDB';
import { debugTaskForAll } from '../../openland-utils/debugTask';

export const Resolver: GQLResolver = {
    Mutation: {
        betaFixCounter: withPermission('super-admin', async (ctx, args) => {
            return await Modules.Messaging.fixer.fixForUser(ctx, IDs.User.parse(args.uid));
        }),
        betaFixCountersForAll: withPermission('super-admin', async (parent, args) => {
            debugTaskForAll(Store.User, parent.auth.uid!, 'betaFixCountersForAll', async (ctx, uid, log) => {
                try {
                    await Modules.Messaging.fixer.fixForUserModern(uid);
                } catch (e) {
                    await log('error: ' + e);
                }
            });
            return true;
        }),
        deliverCountersForAll: withPermission('super-admin', async (parent, args) => {
            debugTaskForAll(Store.User, parent.auth.uid!, 'deliverCountersForAllbetaFixCountersForAll deliver counters', async (ctx, uid, log) => {
                try {
                    await Modules.Messaging.fixer.deliverUserCounters(ctx, uid);
                } catch (e) {
                    await log('error: ' + e);
                }
            });
            return true;
        }),
    }
};
