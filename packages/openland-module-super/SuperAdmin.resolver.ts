import { FDB } from 'openland-module-db/FDB';
import { SuperAdmin } from 'openland-module-db/schema';
import { withPermission } from 'openland-server/api/utils/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-server/api/utils/IDs';

export default {
    SuperAdmin: {
        user: (src: SuperAdmin) => FDB.User.findById(src.id),
        role: (src: SuperAdmin) => {
            if (src.role === 'software-developer') {
                return 'SOFTWARE_DEVELOPER';
            } else if (src.role === 'editor') {
                return 'EDITOR';
            } else {
                return 'SUPER_ADMIN';
            }
        },
        email: async (src: SuperAdmin) => (await FDB.User.findById(src.id))!.email,
    },
    Query: {
        superAdmins: withPermission('super-admin', () => {
            return Modules.Super.findAllSuperAdmins();
        }),
    },
    Mutation: {
        superAdminAdd: withPermission<{ userId: string, role: 'SUPER_ADMIN' | 'SOFTWARE_DEVELOPER' | 'EDITOR' }>('super-admin', async (args) => {
            let uid = IDs.User.parse(args.userId);
            let role = 'editor';
            if (args.role === 'SUPER_ADMIN') {
                role = 'super-admin';
            } else if (args.role === 'SOFTWARE_DEVELOPER') {
                role = 'software-developer';
            }
            await Modules.Super.makeSuperAdmin(uid, role);
            return 'ok';
        }),
        superAdminRemove: withPermission<{ userId: string }>('super-admin', async (args) => {
            let uid = IDs.User.parse(args.userId);
            await Modules.Super.makeNormalUser(uid);
            return 'ok';
        })
    }
};