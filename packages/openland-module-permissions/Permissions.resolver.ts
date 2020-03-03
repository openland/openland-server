import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withActivatedUser, withPermission } from '../openland-module-api/Resolvers';
import { Modules } from '../openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { AuthContext } from '../openland-module-auth/AuthContext';
import { AppContext } from '../openland-modules/AppContext';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { Store } from '../openland-module-db/FDB';
import { PermissionUpdatedEvent } from '../openland-module-db/store';

export const Resolver: GQLResolver = {
    PermissionScope: {
        GLOBAL: 'global',
        CHAT: 'chat'
    },
    PermissionAppType: {
        POWERUP: 'powerup'
    },
    PermissionStatus: {
        REJECTED: 'rejected',
        WAITING: 'waiting',
        GRANTED: 'granted'
    },
    UpdatedPermissionStatus: {
        REJECTED: 'rejected',
        GRANTED: 'granted'
    },
    Permission: {
        id: root => IDs.PermissionRequest.serialize(root.id),
        appType: root => root.appType,
        chat: root => root.scopeId,
        scope: root => root.scopeType,
        powerup: (root, _, ctx) => Store.Powerup.findById(ctx, root.appId),
        group: (root, _, ctx) => Modules.Permissions.getPermissionGroup(ctx, root.gid),
        status: (root) => root.status,
    },
    PermissionGroup: {
        id: root => IDs.PermissionGroup.serialize(root.id),
        description: root => root.description,
        name: root => root.name,
        permissions: withActivatedUser((ctx, args, uid, root) => {
            return Modules.Permissions.getPermissionsForGroup(ctx, uid, root.id);
        })
    },
    Query: {
        permissionGroups: withPermission('super-admin', async (ctx) => {
            return Modules.Permissions.getPermissionGroups(ctx);
        }),
        waitingPermissions: withPermission('super-admin', (ctx) => {
            let auth = AuthContext.get(ctx);
            return Modules.Permissions.getWaitingPermissions(ctx, auth.uid!);
        })
    },
    Mutation: {
      permissionUpdate: withPermission('super-admin', (ctx, args) => {
          let id = IDs.PermissionRequest.parse(args.id);
          return Modules.Permissions.updatePermissionStatus(ctx, ctx.auth.uid!, id, args.status.toLowerCase() as any);
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
                let ls = Store.PermissionEventStore.createLiveStream(ctx, ctx.auth.uid, { batchSize: 1 });
                for await (let e of ls) {
                    for (let item of e.items) {
                        if (item instanceof PermissionUpdatedEvent) {
                            yield await Store.Permission.findById(ctx, item.id);
                        }
                    }
                }
            }
        },
    }
};