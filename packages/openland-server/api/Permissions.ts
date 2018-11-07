import { CallContext } from './utils/CallContext';
import { Repos } from '../repositories';
import { withPermission, withAny } from './utils/Resolvers';
import { IDs } from './utils/IDs';
import { UserError } from '../errors/UserError';
import { Modules } from 'openland-modules/Modules';
import { SuperAdmin, Organization } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';

export const Resolvers = {
    SuperAccountState: {
        PENDING: 'pending',
        ACTIVATED: 'activated',
        SUSPENDED: 'suspended'
    },
    SuperAccount: {
        id: (src: Organization) => IDs.SuperAccount.serialize(src.id!!),
        orgId: (src: Organization) => IDs.Organization.serialize(src.id!!),
        title: async (src: Organization) => (await FDB.OrganizationProfile.findById(src.id))!.name,
        name: async (src: Organization) => (await FDB.OrganizationProfile.findById(src.id))!.name,
        state: (src: Organization) => src.status,
        members: (src: Organization) => Repos.Users.fetchOrganizationMembers(src.id!!),
        features: async (src: Organization) => (await Modules.Features.repo.findOrganizationFeatureFlags(src.id!!)),
        alphaPublished: async (src: Organization) => (await FDB.OrganizationEditorial.findById(src.id))!.listed,
        createdAt: (src: Organization) => (src as any).createdAt,
        createdBy: async (src: Organization) => await FDB.User.findById(src.ownerId),
    },
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
        permissions: async function (_: any, _params: {}, context: CallContext) {
            return {
                roles: Repos.Permissions.resolvePermissions({ uid: context.uid, oid: context.oid })
            };
        },
        myPermissions: async function (_: any, _params: {}, context: CallContext) {
            return {
                roles: Repos.Permissions.resolvePermissions({ uid: context.uid, oid: context.oid })
            };
        },
        superAdmins: withPermission('super-admin', () => {
            return Modules.Super.findAllSuperAdmins();
        }),
        superAccounts: withPermission('super-admin', () => {
            return Repos.Super.fetchAllOrganizations();
        }),
        superAccount: withPermission<{ id: string, viaOrgId?: boolean }>('super-admin', (args) => {
            return Repos.Super.fetchById(args.viaOrgId ? IDs.Organization.parse(args.id) : IDs.SuperAccount.parse(args.id));
        }),
        users: withPermission<{ query: string }>('super-admin', async (args) => {
            // let sequelize = DB.connection;
            // let usersProfiles = await DB.UserProfile.findAll({
            //     where:
            //         [
            //             sequelize.or(
            //                 sequelize.where(sequelize.fn('concat', sequelize.col('firstName'), ' ', sequelize.col('lastName')), {
            //                     $ilike: '%' + args.query.toLowerCase() + '%'
            //                 }),
            //                 {
            //                     firstName: {
            //                         $ilike: args.query.toLowerCase() + '%'
            //                     }
            //                 },
            //                 {
            //                     lastName: {
            //                         $ilike: args.query.toLowerCase() + '%'
            //                     }
            //                 },
            //                 {
            //                     email: {
            //                         $ilike: '%' + args.query.toLowerCase() + '%'
            //                     }
            //                 }
            //             ),
            //         ],
            // });
            // let userIds = usersProfiles.map(u => u.userId!!);
            // return await DB.User.findAll({
            //     where: {
            //         id: {
            //             $in: userIds
            //         }
            //     },
            //     limit: 10
            // });
            throw new UserError('Not supported yet');
        }),
    },
    Mutation: {
        superAccountRename: withPermission<{ id: string, title: string }>('super-admin', (args) => {
            return Repos.Super.renameOrganization(IDs.SuperAccount.parse(args.id), args.title);
        }),
        superAccountActivate: withPermission<{ id: string }>('super-admin', (args) => {
            return Repos.Super.activateOrganization(IDs.SuperAccount.parse(args.id));
        }),
        superAccountPend: withPermission<{ id: string }>('super-admin', (args) => {
            return Repos.Super.pendOrganization(IDs.SuperAccount.parse(args.id));
        }),
        superAccountSuspend: withPermission<{ id: string }>('super-admin', (args) => {
            return Repos.Super.suspendOrganization(IDs.SuperAccount.parse(args.id));
        }),
        superAccountMemberAdd: withPermission<{ id: string, userId: string }>('super-admin', async (args) => {
            return await Repos.Super.addToOrganization(IDs.SuperAccount.parse(args.id), IDs.User.parse(args.userId));
        }),
        superAccountMemberRemove: withPermission<{ id: string, userId: string }>('super-admin', (args) => {
            return Repos.Super.removeFromOrganization(IDs.SuperAccount.parse(args.id), IDs.User.parse(args.userId));
        }),
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
        }),
        superAccountChannelMemberAdd: withPermission<{ id: string, userId: string }>('super-admin', async (args) => {
            return await inTx(async () => {
                await Repos.Chats.addToChannel(IDs.Conversation.parse(args.id), IDs.User.parse(args.userId));
                return 'ok';
            });
        }),
    }
};