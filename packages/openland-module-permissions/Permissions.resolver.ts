import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withActivatedUser, withPermission } from '../openland-module-api/Resolvers';
import { Modules } from '../openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { AuthContext } from '../openland-module-auth/AuthContext';
import { AppContext } from '../openland-modules/AppContext';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { Store } from '../openland-module-db/FDB';

export default {
    PermissionGroup: {
      id: root => IDs.PermissionGroup.serialize(root.id),
        description: root => root.description,
        name: root => root.name,
        permissions: withActivatedUser((ctx, args, uid, root) => {
          return Modules.Permissions.getPermissionsForGroup(ctx, uid, root.id);
        })
    },
    Query: {
        permissionGroups: withPermission('super-admin', (ctx) => {
            return Modules.Permissions.getPermissionGroups(ctx);
        }),
        waitingPermissions: withPermission('super-admin', (ctx) => {
            let auth = AuthContext.get(ctx);
            return Modules.Permissions.getWaitingPermissions(ctx, auth.uid!);
        })
    },
    Subscription: {
        permissionsUpdates: {
            resolve(obj: any) {
                return obj;
            },
            subscribe: async function * (root: any, args: any, ctx: AppContext) {
                if (!ctx.auth.uid) {
                    throw new AccessDeniedError();
                }

                let permissions = await Modules.Permissions.getUserPermissions(ctx, ctx.auth.uid!);
                for (let a of permissions) {
                    yield a;
                }
                Store.PermissionEventStore.createLiveStream(ctx, ctx.auth.uid, { batchSize: 1 });
            }
        },
    }
} as GQLResolver;