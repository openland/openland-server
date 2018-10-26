import { CallContext } from './utils/CallContext';
import { Repos } from '../repositories';
import { withPermission, withAny } from './utils/Resolvers';
import { Organization } from '../tables/Organization';
import { IDs } from './utils/IDs';
import { DB } from '../tables';
import { SuperAdmin } from '../tables/SuperAdmin';
import { UserError } from '../errors/UserError';
import { Modules } from 'openland-modules/Modules';
import { FeatureFlag } from 'openland-module-db/schema';

export const Resolvers = {
    SuperAccount: {
        id: (src: Organization) => IDs.SuperAccount.serialize(src.id!!),
        orgId: (src: Organization) => IDs.Organization.serialize(src.id!!),
        title: (src: Organization) => src.name!!,
        name: (src: Organization) => src.name!!,
        state: (src: Organization) => src.status,
        members: (src: Organization) => Repos.Users.fetchOrganizationMembers(src.id!!),
        features: (src: Organization) => (src as any).getFeatureFlags(),
        alphaPublished: (src: Organization) => !!(!src.extras || src.extras.published),
        createdAt: (src: Organization) => (src as any).createdAt,
        createdBy: async (src: Organization) => await DB.User.findOne({ where: { id: src.createdBy } }),
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
        },
        email: (src: SuperAdmin) => src.user ? src.user.email : null,
    },
    // Task: {
    //     id: (src: Task) => IDs.Task.serialize(src.id),
    //     status: (src: Task) => {
    //         if (src.taskStatus === 'completed') {
    //             return 'COMPLETED';
    //         } else if (src.taskStatus === 'failed') {
    //             return 'FAILED';
    //         } else {
    //             return 'IN_PROGRESS';
    //         }
    //     },
    //     result: (src: Task) => {
    //         return src.result && JSON.stringify(src.result);
    //     }
    // },
    FeatureFlag: {
        id: (src: FeatureFlag) => src.key /* TODO: FIXME */,
        title: (src: FeatureFlag) => src.title,
        key: (src: FeatureFlag) => src.key
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
        featureFlags: withPermission(['super-admin', 'software-developer'], () => {
            return Modules.Features.repo.findAllFeatures();
        }),
        alphaRefreshTask: withAny<{ id: string }>((args) => {
            return null;
        })
    },
    Mutation: {
        superAccountAdd: withPermission<{ title: string }>('super-admin', (args) => {
            return Repos.Super.createOrganization(args.title);
        }),
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
            return await DB.tx(async (tx) => {
                return await Repos.Super.addToOrganization(IDs.SuperAccount.parse(args.id), IDs.User.parse(args.userId), tx);
            });

        }),
        superAccountMemberRemove: withPermission<{ id: string, userId: string }>('super-admin', (args) => {
            return Repos.Super.removeFromOrganization(IDs.SuperAccount.parse(args.id), IDs.User.parse(args.userId));
        }),
        featureFlagAdd: withPermission<{ key: string, title: string }>(['super-admin', 'software-developer'], async (args) => {
            return Modules.Features.repo.createFeatureFlag(args.key, args.title);
        }),
        superAccountFeatureAdd: withPermission<{ id: string, featureId: string }>(['super-admin', 'software-developer'], async (args) => {
            let org = await Repos.Super.fetchById(IDs.SuperAccount.parse(args.id));
            await Modules.Features.repo.enableFeatureForOrganization(org.id!, args.featureId);
            return org;
        }),
        superAccountFeatureRemove: withPermission<{ id: string, featureId: string }>(['super-admin', 'software-developer'], async (args) => {
            let org = await Repos.Super.fetchById(IDs.SuperAccount.parse(args.id));
            await Modules.Features.repo.disableFeatureForOrganization(org.id!, args.featureId);
            return org;
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
        superMultiplyValue: withPermission<{ value: number }>(['super-admin', 'software-developer'], async (args) => {
            return null;
        }),
        superAccountChannelMemberAdd: withPermission<{ id: string, userId: string }>('super-admin', async (args) => {
            return await DB.txStable(async (tx) => {
                await Repos.Chats.addToChannel(tx, IDs.Conversation.parse(args.id), IDs.User.parse(args.userId));
                return 'ok';
            });

        }),
    }
};