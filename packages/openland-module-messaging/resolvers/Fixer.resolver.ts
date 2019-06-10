import { withPermission } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { IDs } from 'openland-module-api/IDs';
import { FDB } from '../../openland-module-db/FDB';
import { debugTask } from '../../openland-utils/debugTask';

export default {
    Mutation: {
        betaFixCounter: withPermission('super-admin', async (ctx, args) => {
            return await Modules.Messaging.fixer.fixForUser(ctx, IDs.User.parse(args.uid));
        }),
        betaFixCountersForAll: withPermission('super-admin', async (ctx, args) => {
            debugTask(ctx.auth.uid!, 'fix-counters-for-all', async (log) => {
                let users = await FDB.User.findAll(ctx);
                let i = 0;
                for (let user of users) {
                    try {
                        await Modules.Messaging.fixer.fixForUser(ctx, user.id);
                        await Modules.Messaging.fixer.deliverUserCounters(ctx, user.id);
                        if ((i % 100) === 0) {
                            await log('done: ' + i);
                        }
                    } catch (e) {
                        await log('error: ' + e);
                    }
                    i++;
                }
                return 'done';
            });
            return true;
        }),
    }
} as GQLResolver;