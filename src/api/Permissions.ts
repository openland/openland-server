import { CallContext } from './CallContext';
import { Repos } from '../repositories';
import { withPermission } from './utils/Resolvers';
import { ID } from '../modules/ID';
import { Organization } from '../tables/Organization';
import { IDs } from './utils/IDs';
import { DB } from '../tables';
import { SuperAdmin } from '../tables/SuperAdmin';

export const SuperAccountId = new ID('SuperAccount');

export const Resolvers = {
    SuperAccount: {
        id: (src: Organization) => SuperAccountId.serialize(src.id!!),
        title: (src: Organization) => src.title!!,
        state: (src: Organization) => src.status,
        members: (src: Organization) => Repos.Users.fetchOrganizationMembers(src.id!!)
    },
    SuperAdmin: {
        user: (src: SuperAdmin) => src.user,
        role: (src: SuperAdmin) => {
            if (src.role === 'software-developer') {
                return 'SOFTWARE_DEVELOPER';
            } else if (src.role === 'editor') {
                return 'EDITOR';
            } else {
                return 'SUPER_ADMIN';
            }
        }
    },
    Query: {
        permissions: async function (_: any, _params: {}, context: CallContext) {
            return {
                roles: Repos.Permissions.resolvePermissions(context.uid)
            };
        },
        superAdmins: withPermission('super-admin', () => {
            return Repos.Permissions.fetchSuperAdmins();
        }),
        superAccounts: withPermission('super-admin', () => {
            return Repos.Super.fetchAllOrganizations();
        }),
        superAccount: withPermission<{ id: string }>('super-admin', (args) => {
            return Repos.Super.fetchById(SuperAccountId.parse(args.id));
        }),
        users: withPermission<{ query: string }>('super-admin', async (args) => {
            return await DB.User.findAll({
                where: {
                    email: {
                        $like: args.query + '%'
                    }
                },
                limit: 10
            });
        })
    },
    Mutation: {
        superAccountAdd: withPermission<{ title: string }>('super-admin', (args) => {
            return Repos.Super.createOrganization(args.title);
        }),
        superAccountActivate: withPermission<{ id: string }>('super-admin', (args) => {
            return Repos.Super.activateOrganization(SuperAccountId.parse(args.id));
        }),
        superAccountSuspend: withPermission<{ id: string }>('super-admin', (args) => {
            return Repos.Super.suspendOrganization(SuperAccountId.parse(args.id));
        }),
        superAccountMemberAdd: withPermission<{ id: string, userId: string }>('super-admin', (args) => {
            return Repos.Super.assingOrganization(SuperAccountId.parse(args.id), IDs.User.parse(args.userId));
        }),
        superAccountMemberRemove: withPermission<{ id: string, userId: string }>('super-admin', (args) => {
            //
        }),
        superAdminAdd: withPermission<{ userId: string, role: 'SUPER_ADMIN' | 'SOFTWARE_DEVELOPER' | 'EDITOR' }>('super-admin', async (args) => {
            let uid = IDs.User.parse(args.userId);
            let role = 'editor';
            if (args.role === 'SUPER_ADMIN') {
                role = 'super-admin';
            } else if (args.role === 'SOFTWARE_DEVELOPER') {
                role = 'software-developer';
            }

            let existing = await DB.SuperAdmin.findOne({
                where: {
                    userId: uid
                }
            });
            if (existing !== null) {
                if (existing.role !== role) {
                    existing.role = role;
                    await existing.save();
                }
                return 'ok';
            }
            await DB.SuperAdmin.create({
                userId: uid,
                role: role
            });
            return 'ok';
        }),
        superAdminRemove: withPermission<{ userId: string }>('super-admin', async (args) => {
            let uid = IDs.User.parse(args.userId);
            if (await DB.SuperAdmin.count() <= 1) {
                throw Error('You can\'t remove last Super Admin from the system');
            }
            await DB.SuperAdmin.destroy({ where: { userId: uid } });
            return 'ok';
        })
    }
};