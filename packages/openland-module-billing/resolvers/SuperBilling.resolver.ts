import { IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { withPermission } from 'openland-module-api/Resolvers';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';

export default {
    Mutation: {
        superEnableBilling: withPermission('super-admin', async (ctx, args) => {
            await Modules.Billing.enableBilling(ctx, IDs.User.parse(args.uid));
            return true;
        })
    }
} as GQLResolver;