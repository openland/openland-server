import { Context } from '@openland/context';
import { withPermission } from 'openland-module-api/Resolvers';
import { IDs } from 'openland-module-api/IDs';
import { Store } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';
import { UserError } from 'openland-errors/UserError';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { Organization } from 'openland-module-db/store';

export const Resolver: GQLResolver = {
    SuperAccountState: {
        PENDING: 'pending',
        ACTIVATED: 'activated',
        SUSPENDED: 'suspended',
        DELETED: 'deleted'
    },
    SuperAccount: {
        id: (src: Organization) => IDs.SuperAccount.serialize(src.id),
        orgId: (src: Organization) => IDs.Organization.serialize(src.id),
        title: async (src: Organization, args: {}, ctx: Context) => (await Store.OrganizationProfile.findById(ctx, src.id))!.name,
        name: async (src: Organization, args: {}, ctx: Context) => (await Store.OrganizationProfile.findById(ctx, src.id))!.name,
        state: (src: Organization) => src.status as any,
        members: (src: Organization, args: {}, ctx: Context) => Modules.Orgs.findOrganizationMembers(ctx, src.id),
        alphaPublished: async (src: Organization, args: {}, ctx: Context) => (await Store.OrganizationEditorial.findById(ctx, src.id))!.listed,
        createdAt: (src: Organization) => src.metadata.createdAt + '',
        createdBy: async (src: Organization, args: {}, ctx: Context) => await Store.User.findById(ctx, src.ownerId),
    },
    Query: {
        superAccounts: withPermission('super-admin', (ctx) => {
            return Store.Organization.findAll(ctx);
        }),
        superAccount: withPermission('super-admin', async (ctx, args) => {
            return (await Store.Organization.findById(ctx, args.viaOrgId ? IDs.Organization.parse(args.id) : IDs.SuperAccount.parse(args.id)))!;
        }),
    },
    Mutation: {
        superAccountRename: withPermission('super-admin', async (ctx, args) => {
            return await Modules.Orgs.renameOrganization(ctx, IDs.SuperAccount.parse(args.id), args.title);
        }),
        superAccountActivate: withPermission('super-admin', async (ctx, args) => {
            let oid = IDs.SuperAccount.parse(args.id);
            await Modules.Orgs.activateOrganization(ctx, oid, true, true);
            return (await Store.Organization.findById(ctx, oid))!;
        }),
        superAccountPend: withPermission('super-admin', (ctx, args) => {
            throw new UserError('Pend is unsupported');
        }),
        superAccountSuspend: withPermission('super-admin', async (ctx, args) => {
            let oid = IDs.SuperAccount.parse(args.id);
            await Modules.Orgs.suspendOrganization(ctx, IDs.SuperAccount.parse(args.id));
            return (await Store.Organization.findById(ctx, oid))!;
        }),
        superAccountMemberAdd: withPermission('super-admin', (ctx, args) => {
            return Modules.Orgs.addUserToOrganization(ctx, IDs.User.parse(args.userId), IDs.SuperAccount.parse(args.id), ctx.auth.uid!);
        }),
        superAccountMemberRemove: withPermission('super-admin', async (ctx, args) => {
            await Modules.Orgs.removeUserFromOrganization(ctx, IDs.User.parse(args.userId), IDs.SuperAccount.parse(args.id), ctx.auth.uid!);
            return (await Store.Organization.findById(ctx, IDs.SuperAccount.parse(args.id)))!;
        }),
        superAccountChannelMemberAdd: withPermission('super-admin', async (ctx, args) => {
            await Modules.Messaging.room.joinRoom(ctx, IDs.Conversation.parse(args.id), IDs.User.parse(args.userId), true);
            return 'ok';
        }),
        superDeleteUser: withPermission('super-admin', async (ctx, args) => {
            await Modules.Users.deleteUser(ctx, IDs.User.parse(args.id));
            return true;
        }),
    }
};
