import { withPermission } from 'openland-module-api/Resolvers';
import { IDs } from 'openland-module-api/IDs';
import { Organization } from 'openland-module-db/schema';
import { FDB } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';
import { UserError } from 'openland-errors/UserError';
import { AppContext } from 'openland-modules/AppContext';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';

export default {
    SuperAccountState: {
        PENDING: 'pending',
        ACTIVATED: 'activated',
        SUSPENDED: 'suspended',
        DELETED: 'deleted'
    },
    SuperAccount: {
        id: (src: Organization) => IDs.SuperAccount.serialize(src.id),
        orgId: (src: Organization) => IDs.Organization.serialize(src.id),
        title: async (src: Organization, args: {}, ctx: AppContext) => (await FDB.OrganizationProfile.findById(ctx, src.id))!.name,
        name: async (src: Organization, args: {}, ctx: AppContext) => (await FDB.OrganizationProfile.findById(ctx, src.id))!.name,
        state: (src: Organization) => src.status as any,
        members: (src: Organization, args: {}, ctx: AppContext) => Modules.Orgs.findOrganizationMembers(ctx, src.id),
        features: async (src: Organization, args: {}, ctx: AppContext) => (await Modules.Features.repo.findOrganizationFeatureFlags(ctx, src.id)).filter(f => !!f),
        alphaPublished: async (src: Organization, args: {}, ctx: AppContext) => (await FDB.OrganizationEditorial.findById(ctx, src.id))!.listed,
        createdAt: (src: Organization) => src.createdAt + '',
        createdBy: async (src: Organization, args: {}, ctx: AppContext) => await FDB.User.findById(ctx, src.ownerId),
    },
    Query: {
        superAccounts: withPermission('super-admin', (ctx) => {
            return FDB.Organization.findAll(ctx);
        }),
        superAccount: withPermission('super-admin', (ctx, args) => {
            return FDB.Organization.findById(ctx, args.viaOrgId ? IDs.Organization.parse(args.id) : IDs.SuperAccount.parse(args.id));
        }),
    },
    Mutation: {
        superAccountRename: withPermission('super-admin', (ctx, args) => {
            return Modules.Orgs.renameOrganization(ctx, IDs.SuperAccount.parse(args.id), args.title);
        }),
        superAccountActivate: withPermission('super-admin', (ctx, args) => {
            return Modules.Orgs.activateOrganization(ctx, IDs.SuperAccount.parse(args.id));
        }),
        superAccountPend: withPermission('super-admin', (ctx, args) => {
            throw new UserError('Pend is unsupported');
        }),
        superAccountSuspend: withPermission('super-admin', (ctx, args) => {
            return Modules.Orgs.suspendOrganization(ctx, IDs.SuperAccount.parse(args.id));
        }),
        superAccountMemberAdd: withPermission('super-admin', (ctx, args) => {
            return Modules.Orgs.addUserToOrganization(ctx, IDs.User.parse(args.userId), IDs.SuperAccount.parse(args.id), ctx.auth.uid!);
        }),
        superAccountMemberRemove: withPermission('super-admin', async (ctx, args) => {
            await Modules.Orgs.removeUserFromOrganization(ctx, IDs.User.parse(args.userId), IDs.SuperAccount.parse(args.id), ctx.auth.uid!);
            return await Modules.DB.entities.Organization.findById(ctx, IDs.SuperAccount.parse(args.id));
        }),
        superAccountChannelMemberAdd: withPermission('super-admin', async (ctx, args) => {
            await Modules.Messaging.room.joinRoom(ctx, IDs.Conversation.parse(args.id), IDs.User.parse(args.userId));
            return 'ok';
        }),
    }
} as GQLResolver;