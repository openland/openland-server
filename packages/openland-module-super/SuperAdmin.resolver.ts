import { FDB } from 'openland-module-db/FDB';
import { SuperAdmin } from 'openland-module-db/schema';
import { withPermission } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { AppContext } from 'openland-modules/AppContext';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';

export default {
    SuperAdmin: {
        user: (src: SuperAdmin, args: {}, ctx: AppContext) => FDB.User.findById(ctx, src.id),
        role: (src: SuperAdmin) => {
            if (src.role === 'software-developer') {
                return 'SOFTWARE_DEVELOPER';
            } else if (src.role === 'editor') {
                return 'EDITOR';
            } else {
                return 'SUPER_ADMIN';
            }
        },
        email: async (src: SuperAdmin, args: {}, ctx: AppContext) => (await FDB.User.findById(ctx, src.id))!.email,
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
} as GQLResolver;