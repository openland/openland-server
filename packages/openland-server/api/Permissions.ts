import { CallContext } from './utils/CallContext';
import { Repos } from '../repositories';
import { withPermission, withAny } from './utils/Resolvers';
import { Organization } from '../tables/Organization';
import { IDs } from './utils/IDs';
import { DB } from '../tables';
import { SuperAdmin } from '../tables/SuperAdmin';
import { FeatureFlag } from '../tables/FeatureFlag';
import { SuperCity } from '../tables/SuperCity';
import { SampleWorker } from '../workers';
import { Task } from '../tables/Task';
import { UserError } from '../errors/UserError';
import { ErrorText } from '../errors/ErrorText';

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
    Task: {
        id: (src: Task) => IDs.Task.serialize(src.id),
        status: (src: Task) => {
            if (src.taskStatus === 'completed') {
                return 'COMPLETED';
            } else if (src.taskStatus === 'failed') {
                return 'FAILED';
            } else {
                return 'IN_PROGRESS';
            }
        },
        result: (src: Task) => {
            return src.result && JSON.stringify(src.result);
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
                roles: Repos.Permissions.resolvePermissions({ uid: context.uid, oid: context.oid })
            };
        },
        myPermissions: async function (_: any, _params: {}, context: CallContext) {
            return {
                roles: Repos.Permissions.resolvePermissions({ uid: context.uid, oid: context.oid })
            };
        },
        superAdmins: withPermission('super-admin', () => {
            return Repos.Permissions.fetchSuperAdmins();
        }),
        superAccounts: withPermission('super-admin', () => {
            return Repos.Super.fetchAllOrganizations();
        }),
        superAccount: withPermission<{ id: string, viaOrgId?: boolean }>('super-admin', (args) => {
            return Repos.Super.fetchById(args.viaOrgId ? IDs.Organization.parse(args.id) : IDs.SuperAccount.parse(args.id));
        }),
        users: withPermission<{ query: string }>('super-admin', async (args) => {
            let sequelize = DB.connection;
            let usersProfiles = await DB.UserProfile.findAll({
                where:
                    [
                        sequelize.or(
                            sequelize.where(sequelize.fn('concat', sequelize.col('firstName'), ' ', sequelize.col('lastName')), {
                                $ilike: '%' + args.query.toLowerCase() + '%'
                            }),
                            {
                                firstName: {
                                    $ilike: args.query.toLowerCase() + '%'
                                }
                            },
                            {
                                lastName: {
                                    $ilike: args.query.toLowerCase() + '%'
                                }
                            },
                            {
                                email: {
                                    $ilike: '%' + args.query.toLowerCase() + '%'
                                }
                            }
                        ),
                    ],
            });
            let userIds = usersProfiles.map(u => u.userId!!);
            return await DB.User.findAll({
                where: {
                    id: {
                        $in: userIds
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
        alphaRefreshTask: withAny<{ id: string }>((args) => {
            return DB.Task.findById(IDs.Task.parse(args.id));
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
                throw new UserError(ErrorText.unableToRemoveLastSuperAdmin);
            }
            await DB.SuperAdmin.destroy({ where: { userId: uid } });
            return 'ok';
        }),
        superMultiplyValue: withPermission<{ value: number }>(['super-admin', 'software-developer'], async (args) => {
            return SampleWorker.pushWork({ someArgument: args.value });
        }),
        superAccountChannelMemberAdd: withPermission<{ id: string, userId: string }>('super-admin', async (args) => {
            return await DB.txStable(async (tx) => {
                await Repos.Chats.addToChannel(tx, IDs.Conversation.parse(args.id), IDs.User.parse(args.userId));
                return 'ok';
            });

        }),
    }
};