import { withPermission } from 'openland-module-api/Resolvers';
import { IDs } from 'openland-module-api/IDs';
import { Organization } from 'openland-module-db/schema';
import { FDB } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';
import { UserError } from 'openland-errors/UserError';

export default {
    SuperAccountState: {
        PENDING: 'pending',
        ACTIVATED: 'activated',
        SUSPENDED: 'suspended'
    },
    SuperAccount: {
        id: (src: Organization) => IDs.SuperAccount.serialize(src.id),
        orgId: (src: Organization) => IDs.Organization.serialize(src.id),
        title: async (src: Organization) => (await FDB.OrganizationProfile.findById(src.id))!.name,
        name: async (src: Organization) => (await FDB.OrganizationProfile.findById(src.id))!.name,
        state: (src: Organization) => src.status,
        members: (src: Organization) => Modules.Orgs.findOrganizationMembers(src.id),
        features: async (src: Organization) => (await Modules.Features.repo.findOrganizationFeatureFlags(src.id)),
        alphaPublished: async (src: Organization) => (await FDB.OrganizationEditorial.findById(src.id))!.listed,
        createdAt: (src: Organization) => (src as any).createdAt,
        createdBy: async (src: Organization) => await FDB.User.findById(src.ownerId),
    },
    Query: {
        superAccounts: withPermission('super-admin', () => {
            return FDB.Organization.findAll();
        }),
        superAccount: withPermission<{ id: string, viaOrgId?: boolean }>('super-admin', (ctx, args) => {
            return FDB.Organization.findById(args.viaOrgId ? IDs.Organization.parse(args.id) : IDs.SuperAccount.parse(args.id));
        }),
    },
    Mutation: {
        superAccountRename: withPermission<{ id: string, title: string }>('super-admin', (ctx, args) => {
            return Modules.Orgs.renameOrganization(IDs.SuperAccount.parse(args.id), args.title);
        }),
        superAccountActivate: withPermission<{ id: string }>('super-admin', (ctx, args) => {
            return Modules.Orgs.activateOrganization(IDs.SuperAccount.parse(args.id));
        }),
        superAccountPend: withPermission<{ id: string }>('super-admin', (ctx, args) => {
            throw new UserError('Pend is unsupported');
        }),
        superAccountSuspend: withPermission<{ id: string }>('super-admin', (ctx, args) => {
            return Modules.Orgs.suspendOrganization(IDs.SuperAccount.parse(args.id));
        }),
        superAccountMemberAdd: withPermission<{ id: string, userId: string }>('super-admin', (ctx, args) => {
            return Modules.Orgs.addUserToOrganization(IDs.User.parse(args.userId), IDs.SuperAccount.parse(args.id), IDs.User.parse(args.userId));
        }),
        superAccountMemberRemove: withPermission<{ id: string, userId: string }>('super-admin', (ctx, args) => {
            return Modules.Orgs.removeUserFromOrganization(IDs.User.parse(args.userId), IDs.SuperAccount.parse(args.id), IDs.User.parse(args.userId));
        }),
        superAccountChannelMemberAdd: withPermission<{ id: string, userId: string }>('super-admin', async (ctx, args) => {
            await Modules.Messaging.room.joinRoom(IDs.Conversation.parse(args.id), IDs.User.parse(args.userId));
            return 'ok';
        }),
    }
};