import { CallContext } from './CallContext';
import { Repos } from '../repositories';
import { withPermission } from './utils/Resolvers';
import { Organization } from '../tables/Organization';
import { IDs } from './utils/IDs';
import { DB } from '../tables';
import { SuperAdmin } from '../tables/SuperAdmin';
import { FeatureFlag } from '../tables/FeatureFlag';
import { SuperCity } from '../tables/SuperCity';

export const Resolvers = {
    SuperAccount: {
        id: (src: Organization) => IDs.SuperAccount.serialize(src.id!!),
        title: (src: Organization) => src.title!!,
        state: (src: Organization) => src.status,
        members: (src: Organization) => Repos.Users.fetchOrganizationMembers(src.id!!),
        features: (src: Organization) => (src as any).getFeatureFlags()
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
    SuperCity: {
        id: (src: SuperCity) => IDs.SuperCity.serialize(src.id),
        key: (src: SuperCity) => src.key,
        enabled: (src: SuperCity) => src.enabled,
        blockSource: (src: SuperCity) => src.blockSource,
        blockSourceLayer: (src: SuperCity) => src.blockSourceLayer,
        parcelSource: (src: SuperCity) => src.parcelSource,
        parcelSourceLayer: (src: SuperCity) => src.parcelSourceLayer,
    },
    FeatureFlag: {
        id: (src: FeatureFlag) => IDs.FeatureFlag.serialize(src.id!!),
        title: (src: FeatureFlag) => src.title,
        key: (src: FeatureFlag) => src.key
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
            return Repos.Super.fetchById(IDs.SuperAccount.parse(args.id));
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
        }),
        featureFlags: withPermission(['super-admin', 'software-developer'], () => {
            return Repos.Permissions.resolveFeatureFlags();
        }),
        superCities: withPermission('super-admin', () => {
            return Repos.Permissions.resolveCiites();
        }),
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
        superAccountSuspend: withPermission<{ id: string }>('super-admin', (args) => {
            return Repos.Super.suspendOrganization(IDs.SuperAccount.parse(args.id));
        }),
        superAccountMemberAdd: withPermission<{ id: string, userId: string }>('super-admin', (args) => {
            return Repos.Super.assingOrganization(IDs.SuperAccount.parse(args.id), IDs.User.parse(args.userId));
        }),
        superAccountMemberRemove: withPermission<{ id: string, userId: string }>('super-admin', (args) => {
            return Repos.Super.detachOrganization(IDs.SuperAccount.parse(args.id), IDs.User.parse(args.userId));
        }),
        featureFlagAdd: withPermission<{ key: string, title: string }>(['super-admin', 'software-developer'], async (args) => {
            return Repos.Permissions.createFeatureFlag(args.key, args.title);
        }),
        superAccountFeatureAdd: withPermission<{ id: string, featureId: string }>(['super-admin', 'software-developer'], async (args) => {
            let org = await Repos.Super.fetchById(IDs.SuperAccount.parse(args.id));
            await (org as any).addFeatureFlag(IDs.FeatureFlag.parse(args.featureId));
            return org;
        }),
        superAccountFeatureRemove: withPermission<{ id: string, featureId: string }>(['super-admin', 'software-developer'], async (args) => {
            let org = await Repos.Super.fetchById(IDs.SuperAccount.parse(args.id));
            await (org as any).removeFeatureFlag(IDs.FeatureFlag.parse(args.featureId));
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