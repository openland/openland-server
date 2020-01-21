import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withPermission } from '../openland-module-api/Resolvers';
import { Modules } from '../openland-modules/Modules';

export default {
    Query: {
        permissionGroups: withPermission('super-admin', (ctx, args, root) => {
            return Modules.Permissions.
        })
    }
} as GQLResolver;