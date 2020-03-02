import { Store } from 'openland-module-db/FDB';
import { withPermission } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';

export const Resolver: GQLResolver = {
    SuperAdmin: {
        user: async (src, args, ctx) => (await Store.User.findById(ctx, src.id))!,
        role: (src) => {
            if (src.role === 'software-developer') {
                return 'SOFTWARE_DEVELOPER';
            } else if (src.role === 'editor') {
                return 'EDITOR';
            } else {
                return 'SUPER_ADMIN';
            }
        },
        email: async (src, args, ctx) => (await Store.User.findById(ctx, src.id))!.email,
    },
    Query: {
        superAdmins: withPermission('super-admin', (ctx) => {
            return Modules.Super.findAllSuperAdmins(ctx);
        }),
    },
    Mutation: {
        superAdminAdd: withPermission('super-admin', async (ctx, args) => {
            let uid = IDs.User.parse(args.userId);
            let role = 'editor';
            if (args.role === 'SUPER_ADMIN') {
                role = 'super-admin';
            } else if (args.role === 'SOFTWARE_DEVELOPER') {
                role = 'software-developer';
            }
            await Modules.Super.makeSuperAdmin(ctx, uid, role);
            return 'ok';
        }),
        superAdminRemove: withPermission('super-admin', async (ctx, args) => {
            let uid = IDs.User.parse(args.userId);
            await Modules.Super.makeNormalUser(ctx, uid);
            return 'ok';
        })
    }
};
