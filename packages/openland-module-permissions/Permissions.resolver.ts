import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withPermission } from '../openland-module-api/Resolvers';
import { Modules } from '../openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { AuthContext } from '../openland-module-auth/AuthContext';

export const Resolver: GQLResolver = {
    PermissionGroup: {
      id: root => IDs.PermissionGroup.serialize(root.id),
        description: root => root.description,
        name: root => root.name,
        requests: (root, args, ctx) => {
          let auth = AuthContext.get(ctx);
          return Modules.Permissions.getPermissionsForGroup(ctx, auth.uid!, root.id);
        }
    },
    Query: {
        permissionGroups: withPermission('super-admin', async (ctx) => {
            return Modules.Permissions.getPermissionGroups(ctx);
        }),
        waitingPermissionRequests: withPermission('super-admin', (ctx) => {
            let auth = AuthContext.get(ctx);
            return Modules.Permissions.getWaitingPermissions(ctx, auth.uid!);
        })
    }
};
